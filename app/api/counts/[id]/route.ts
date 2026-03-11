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

    const { data: lines, error } = await supabase
      .from("inventory_count_lines")
      .select("*")
      .eq("inventory_count_id", id)
      .order("item_category", { ascending: true })
      .order("item_sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: "Supabase query failed",
          details: error.message,
          code: error.code,
          hint: error.hint,
          countId: id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ lines: lines ?? [], countId: id, count });
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