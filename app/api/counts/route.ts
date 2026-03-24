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

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    let body: { closing_run_id?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const closingRunId = body.closing_run_id ?? null;

    if (closingRunId) {
      const { data: existingCount, error: existingCountError } = await supabase
        .from("inventory_counts")
        .select("*")
        .eq("closing_run_id", closingRunId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCountError) {
        throw existingCountError;
      }

      if (existingCount) {
        return NextResponse.json({ count: existingCount });
      }
    }

    const count = await createCountSession();

    if (closingRunId) {
      const { data: updatedCount, error: updateError } = await supabase
        .from("inventory_counts")
        .update({ closing_run_id: closingRunId })
        .eq("id", count.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ count: updatedCount });
    }

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