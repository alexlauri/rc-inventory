import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createCountSession } from "@/lib/inventory/queries";

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("inventory_counts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ counts: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load counts",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const count = await createCountSession();
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create count",
      },
      { status: 500 }
    );
  }
}