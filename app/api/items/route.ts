import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("sort_order", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load items",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load items",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createClient();

    const payload = {
      id: body.id,
      name: body.name,
      category: body.category,
      unit: body.unit,
      threshold: Number(body.threshold ?? 0),
      par: Number(body.par ?? 0),
      active: body.active ?? true,
      sort_order: Number(body.sort_order ?? 0),
      notes: body.notes ?? null,
    };

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to create item",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create item",
      },
      { status: 500 }
    );
  }
}