import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const { data: run, error: runError } = await supabase
      .from("closing_runs")
      .select(
        "id, status, inventory_report_message, cash_count_total, report_copied, report_copied_by_name, submitted_by_name"
      )
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message || "Failed to load closing steps");
    }

    if (runError) {
      throw new Error(runError.message || "Failed to load closing run");
    }

    return NextResponse.json(
      {
        steps: steps ?? [],
        run: run ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load closing steps",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
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

    const stepId = body.step_id as string | undefined;
    const hasStepUpdate = typeof stepId === "string" && stepId.length > 0;
    const isComplete = Boolean(body.is_complete);
    const completedByUserId = body.completed_by_user_id as string | undefined;
    const completedByName = body.completed_by_name as string | undefined;
    const inventoryReportMessage = body.inventory_report_message as string | undefined;
    const reportCopied = typeof body.report_copied === "boolean" ? body.report_copied : undefined;
    const reportCopiedByName = body.report_copied_by_name as string | undefined;
    const cashCountTotal =
      typeof body.cash_count_total === "number" ? body.cash_count_total : undefined;

    if (!hasStepUpdate) {
      const runUpdates: Record<string, unknown> = {};

      if (inventoryReportMessage !== undefined) {
        runUpdates.inventory_report_message = inventoryReportMessage;
      }

      if (cashCountTotal !== undefined) {
        runUpdates.cash_count_total = cashCountTotal;
      }

      if (reportCopied !== undefined) {
        runUpdates.report_copied = reportCopied;
      }

      if (reportCopiedByName !== undefined) {
        runUpdates.report_copied_by_name = reportCopiedByName;
      }

      if (Object.keys(runUpdates).length === 0) {
        return NextResponse.json(
          { error: "No valid update payload provided" },
          { status: 400 }
        );
      }

      const { data: run, error: runError } = await supabase
        .from("closing_runs")
        .update(runUpdates)
        .eq("id", id)
        .select(
          "id, status, inventory_report_message, cash_count_total, report_copied, report_copied_by_name, submitted_by_name"
        )
        .single();

      if (runError || !run) {
        throw new Error(runError?.message || "Failed to update closing run");
      }

      return NextResponse.json({ run });
    }

    const { data: step, error } = await supabase
      .from("closing_run_steps")
      .update({
        is_complete: isComplete,
        completed_by_user_id: isComplete ? completedByUserId ?? null : null,
        completed_by_name: isComplete ? completedByName ?? null : null,
        completed_at: isComplete ? new Date().toISOString() : null,
      })
      .eq("closing_run_id", id)
      .eq("id", stepId!)
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