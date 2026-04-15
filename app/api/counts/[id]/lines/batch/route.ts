import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

type LineUpdate = {
  lineId: string;
  trailer_qty: number;
  storage_qty: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: countId } = await context.params;
    const body = await request.json();
    const raw = body.updates as unknown;

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const supabase = createClient();

    const results = await Promise.all(
      raw.map(async (entry): Promise<{ ok: true } | { ok: false; error: string }> => {
        const u = entry as LineUpdate;
        const lineId = u.lineId;
        if (typeof lineId !== "string" || lineId === "") {
          return { ok: false, error: "Invalid lineId" };
        }

        const trailer_qty = Number(u.trailer_qty ?? 0);
        const storage_qty = Number(u.storage_qty ?? 0);

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
          return {
            ok: false,
            error: error.message || "Supabase update failed",
          };
        }

        if (data) {
          const row = data as Record<string, unknown>;
          const countFk =
            (typeof row.inventory_count_id === "string" && row.inventory_count_id) ||
            (typeof row.count_id === "string" && row.count_id) ||
            null;
          if (countFk !== null && countFk !== countId) {
            return { ok: false, error: "Line does not belong to this count" };
          }
        }

        return { ok: true };
      })
    );

    for (const r of results) {
      if (!r.ok) {
        const forbidden = r.error.includes("belong");
        return NextResponse.json({ error: r.error }, { status: forbidden ? 403 : 500 });
      }
    }

    return NextResponse.json({ ok: true, updated: raw.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Batch update failed",
      },
      { status: 500 }
    );
  }
}
