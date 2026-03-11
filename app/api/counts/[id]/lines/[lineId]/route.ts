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

    const { data, error } = await supabase
      .from("inventory_count_lines")
      .update({
        trailer_qty,
        storage_qty,
      })
      .eq("id", lineId)
      .eq("inventory_count_id", id)
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