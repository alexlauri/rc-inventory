import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: count, error: countError } = await supabase
      .from("inventory_counts")
      .select("id, status, count_date")
      .eq("id", id)
      .single();

    if (countError) {
      return NextResponse.json(
        {
          error: "Failed to load count",
          details: countError.message,
          code: countError.code,
          hint: countError.hint,
        },
        { status: 500 }
      );
    }

    const lineForeignKeyCandidates = [
      "inventory_count_id",
      "count_id",
      "inventory_id",
      "run_id",
    ];

    let lines: Record<string, unknown>[] | null = null;
    let resolvedLineForeignKey: string | null = null;
    let lastLineError:
      | { message?: string; code?: string; hint?: string | null }
      | null = null;

    for (const foreignKey of lineForeignKeyCandidates) {
      const { data, error } = await supabase
        .from("inventory_count_lines")
        .select("*")
        .eq(foreignKey, id)
        .order("item_category", { ascending: true })
        .order("item_sort_order", { ascending: true });

      if (error) {
        lastLineError = error;
        continue;
      }

      if (data && data.length > 0) {
        lines = data;
        resolvedLineForeignKey = foreignKey;
        lastLineError = null;
        break;
      }

      if (data && data.length === 0) {
        lines = data;
        if (!resolvedLineForeignKey) {
          resolvedLineForeignKey = foreignKey;
        }
      }
    }

    if (lastLineError) {
      return NextResponse.json(
        {
          error: "Supabase query failed",
          details: lastLineError.message,
          code: lastLineError.code,
          hint: lastLineError.hint,
          countId: id,
        },
        { status: 500 }
      );
    }

    const rawLines = lines ?? [];

    console.log("[counts/:id] rawLines", {
      countId: id,
      countStatus: count.status,
      resolvedLineForeignKey,
      rawLineCount: rawLines.length,
    });

    let synchronizedLines = rawLines;

    // Always sync items so newly added inventory appears in existing counts
    if (true) {
      const existingInventoryItemIds = new Set(
        rawLines
          .map((line) => {
            const inventoryItemId = line.inventory_item_id;
            return typeof inventoryItemId === "string" ? inventoryItemId : null;
          })
          .filter((value): value is string => Boolean(value))
      );

      const { data: inventoryItems, error: inventoryItemsError } = await supabase
        .from("inventory_items")
        .select("*");

      console.log("[counts/:id] inventory items lookup", {
        countId: id,
        inventoryItemsCount: inventoryItems?.length ?? 0,
        inventoryItemsError: inventoryItemsError
          ? {
              message: inventoryItemsError.message,
              code: inventoryItemsError.code,
              hint: inventoryItemsError.hint,
            }
          : null,
      });

      if (!inventoryItemsError && inventoryItems) {
        const missingItems = inventoryItems.filter(
          (item) => !existingInventoryItemIds.has(item.id)
        );

        console.log("[counts/:id] draft sync", {
          countId: id,
          inventoryItemsCount: inventoryItems.length,
          existingInventoryItemIdsCount: existingInventoryItemIds.size,
          missingItemsCount: missingItems.length,
          missingItemNames: missingItems.map((item) => item.item_name),
        });

        if (missingItems.length === 0) {
          console.log("[counts/:id] no missing items detected", {
            countId: id,
            existingInventoryItemIds: Array.from(existingInventoryItemIds),
            inventoryItemIds: inventoryItems.map((item) => item.id),
          });
        }
        if (missingItems.length > 0) {
          const foreignKeysToTry = resolvedLineForeignKey
            ? [resolvedLineForeignKey, ...lineForeignKeyCandidates.filter((key) => key !== resolvedLineForeignKey)]
            : lineForeignKeyCandidates;

          for (const foreignKey of foreignKeysToTry) {
            const missingLinesToInsert = missingItems.map((item) => ({
              [foreignKey]: id,
              inventory_item_id: item.id,
              item_name:
                (typeof item.item_name === "string" && item.item_name) ||
                (typeof item.name === "string" && item.name) ||
                "Unnamed Item",
              item_unit:
                (typeof item.item_unit === "string" && item.item_unit) ||
                (typeof item.unit === "string" && item.unit) ||
                "unit",
              item_category:
                (typeof item.item_category === "string" && item.item_category) ||
                (typeof item.category === "string" && item.category) ||
                "Other",
              item_threshold:
                typeof item.item_threshold === "number"
                  ? item.item_threshold
                  : typeof item.threshold === "number"
                  ? item.threshold
                  : 0,
              item_par:
                typeof item.item_par === "number"
                  ? item.item_par
                  : typeof item.par === "number"
                  ? item.par
                  : 0,
              item_sort_order:
                typeof item.item_sort_order === "number"
                  ? item.item_sort_order
                  : typeof item.sort_order === "number"
                  ? item.sort_order
                  : 0,
              trailer_qty: 0,
              storage_qty: 0,
            }));

            const { data: insertedLines, error: insertMissingLinesError } = await supabase
              .from("inventory_count_lines")
              .insert(missingLinesToInsert)
              .select("*");

            console.log("[counts/:id] insert attempt", {
              countId: id,
              foreignKey,
              attemptedInsertCount: missingLinesToInsert.length,
              insertedLinesCount: insertedLines?.length ?? 0,
              insertError: insertMissingLinesError
                ? {
                    message: insertMissingLinesError.message,
                    code: insertMissingLinesError.code,
                    hint: insertMissingLinesError.hint,
                  }
                : null,
            });

            if (insertMissingLinesError) {
              continue;
            }

            if (insertedLines) {
              resolvedLineForeignKey = foreignKey;
              synchronizedLines = [...rawLines, ...insertedLines].sort((a, b) => {
                const categoryA = typeof a.item_category === "string" ? a.item_category : "";
                const categoryB = typeof b.item_category === "string" ? b.item_category : "";

                if (categoryA !== categoryB) {
                  return categoryA.localeCompare(categoryB);
                }

                const sortOrderA = typeof a.item_sort_order === "number" ? a.item_sort_order : 0;
                const sortOrderB = typeof b.item_sort_order === "number" ? b.item_sort_order : 0;

                return sortOrderA - sortOrderB;
              });
              break;
            }
          }
        }
      }
    }

    const inventoryItemIds = synchronizedLines
      .map((line) => {
        const inventoryItemId = line.inventory_item_id;
        return typeof inventoryItemId === "string" ? inventoryItemId : null;
      })
      .filter((value): value is string => Boolean(value));

    let enrichedLines = synchronizedLines;

    if (inventoryItemIds.length > 0) {
      const { data: inventoryItems, error: inventoryItemsError } = await supabase
        .from("inventory_items")
        .select("*")
        .in("id", inventoryItemIds);

      if (!inventoryItemsError && inventoryItems) {
        const inventoryItemMap = new Map(
          inventoryItems.map((item) => [item.id, item])
        );

        enrichedLines = synchronizedLines.map((line) => {
          const inventoryItemId =
            typeof line.inventory_item_id === "string" ? line.inventory_item_id : null;
          const inventoryItem = inventoryItemId
            ? inventoryItemMap.get(inventoryItemId)
            : null;

          return inventoryItem
            ? {
                ...inventoryItem,
                ...line,
              }
            : line;
        });
      }
    }

    return NextResponse.json({ lines: enrichedLines, countId: id, count });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load count",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const nextStatus = body.status;
    const submittedByUserId = body.submitted_by_user_id;
    const submittedByName = body.submitted_by_name;

    const { data: count, error } = await supabase
      .from("inventory_counts")
      .update({
        status: nextStatus,
        submitted_by_user_id: submittedByUserId,
        submitted_by_name: submittedByName,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, count_date, submitted_by_user_id, submitted_by_name, submitted_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to update count",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update count",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { error } = await supabase
      .from("inventory_counts")
      .delete()
      .eq("id", id)
      .eq("status", "draft");

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to delete count",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete count",
      },
      { status: 500 }
    );
  }
}