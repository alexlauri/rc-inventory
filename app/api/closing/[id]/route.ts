import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: steps, error } = await supabase
      .from("closing_run_steps")
      .select("id, label_snapshot, step_type, tool_key, is_complete, sort_order")
      .eq("closing_run_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load closing steps");
    }

    return NextResponse.json({ steps: steps ?? [] });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load closing steps",
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

    const stepId = body.step_id as string;
    const isComplete = Boolean(body.is_complete);
    const completedByUserId = body.completed_by_user_id as string | undefined;
    const completedByName = body.completed_by_name as string | undefined;

    if (!stepId) {
      return NextResponse.json(
        { error: "step_id is required" },
        { status: 400 }
      );
    }

    const updates = {
      is_complete: isComplete,
      completed_by_user_id: isComplete ? completedByUserId ?? null : null,
      completed_by_name: isComplete ? completedByName ?? null : null,
      completed_at: isComplete ? new Date().toISOString() : null,
    };

    const { data: step, error } = await supabase
      .from("closing_run_steps")
      .update(updates)
      .eq("closing_run_id", id)
      .eq("id", stepId)
      .select("id, label_snapshot, step_type, tool_key, is_complete, sort_order")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update closing step");
    }

    return NextResponse.json({ step });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update closing step",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const submittedByUserId = body.submitted_by_user_id as string | undefined;
    const submittedByName = body.submitted_by_name as string | undefined;

    const { data: run, error } = await supabase
      .from("closing_runs")
      .update({
        status: "submitted",
        submitted_by_user_id: submittedByUserId ?? null,
        submitted_by_name: submittedByName ?? null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, submitted_by_name")
      .single();

    if (error || !run) {
      throw new Error(error?.message || "Failed to submit closing checklist");
    }

    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to submit closing checklist",
      },
      { status: 500 }
    );
  }
}