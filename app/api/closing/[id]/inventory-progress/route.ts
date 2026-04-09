import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: closingRunId } = await params;
    const supabase = createClient();

    const [itemsResult, closingRunResult] = await Promise.all([
      supabase.from("inventory_items").select("id", { count: "exact", head: true }),
      supabase
        .from("closing_runs")
        .select("id, inventory_count_id")
        .eq("id", closingRunId)
        .maybeSingle(),
    ]);

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (closingRunResult.error) {
      throw closingRunResult.error;
    }

    const inventoryTotalCount = itemsResult.count ?? 0;
    const inventoryCountId = closingRunResult.data?.inventory_count_id ?? null;

    if (!inventoryCountId) {
      return NextResponse.json({
        inventoryTotalCount,
        inventorySavedCount: 0,
      });
    }

    const savedLinesResult = await supabase
      .from("inventory_count_lines")
      .select("id", { count: "exact", head: true })
      .eq("inventory_count_id", inventoryCountId)
      .eq("is_saved", true);

    if (savedLinesResult.error) {
      throw savedLinesResult.error;
    }

    return NextResponse.json({
      inventoryTotalCount,
      inventorySavedCount: savedLinesResult.count ?? 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load inventory progress";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}