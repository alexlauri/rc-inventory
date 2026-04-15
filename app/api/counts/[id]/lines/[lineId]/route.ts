import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id, lineId } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const trailer_qty = Number(body.trailer_qty ?? 0);
    const storage_qty = Number(body.storage_qty ?? 0);

    // Match by line id only so updates succeed even when the count FK column
    // name differs from inventory_count_id (GET tries several FKs).
    const { data, error } = await supabase
      .from("inventory_count_lines")
      .update({
        trailer_qty,
        storage_qty,
        is_saved: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lineId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Supabase update failed",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    if (data) {
      const row = data as Record<string, unknown>;
      const countFk =
        (typeof row.inventory_count_id === "string" && row.inventory_count_id) ||
        (typeof row.count_id === "string" && row.count_id) ||
        null;
      if (countFk !== null && countFk !== id) {
        return NextResponse.json(
          { error: "Line does not belong to this count" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ line: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update line",
      },
      { status: 500 }
    );
  }
}