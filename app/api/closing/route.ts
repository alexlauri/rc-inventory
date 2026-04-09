import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST() {
  try {
    const supabase = createClient();

    const now = new Date();
    const nyDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = nyDateParts.find((part) => part.type === "year")?.value;
    const month = nyDateParts.find((part) => part.type === "month")?.value;
    const dayOfMonth = nyDateParts.find((part) => part.type === "day")?.value;

    if (!year || !month || !dayOfMonth) {
      throw new Error("Failed to determine New York run date");
    }

    const today = `${year}-${month}-${dayOfMonth}`;
    const day = now.getDay(); // 0 = Sunday

    // use closing_last_day on Sundays, otherwise standard
    const templateId = day === 0 ? "closing_last_day" : "closing_standard";

    const { data: existingRun, error: existingRunError } = await supabase
      .from("closing_runs")
      .select("*")
      .eq("run_date", today)
      .eq("template_id", templateId)
      .in("status", ["draft", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRunError) {
      throw new Error(existingRunError.message || "Failed to load existing closing run");
    }

    if (existingRun) {
      return NextResponse.json({ run: existingRun });
    }

    const { data: run, error: runError } = await supabase
      .from("closing_runs")
      .insert({
        run_date: today,
        template_id: templateId,
        status: "draft",
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(runError?.message || "Failed to create closing run");
    }

    const { data: templateSteps, error: stepsError } = await supabase
      .from("checklist_template_steps")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (stepsError) {
      throw new Error(stepsError.message || "Failed to load template steps");
    }

    const stepRows =
      templateSteps?.map((step) => ({
        closing_run_id: run.id,
        template_step_id: step.id,
        label_snapshot: step.label,
        step_type: step.step_type,
        tool_key: step.tool_key,
        is_complete: false,
        sort_order: step.sort_order,
      })) ?? [];

    if (stepRows.length > 0) {
      const { error: insertStepsError } = await supabase
        .from("closing_run_steps")
        .insert(stepRows);

      if (insertStepsError) {
        throw new Error(insertStepsError.message || "Failed to create closing run steps");
      }
    }

    const detailTemplateSteps = (templateSteps ?? []).filter(
      (step) => step.step_type === "detail"
    );

    if (detailTemplateSteps.length > 0) {
      const templateStepIds = detailTemplateSteps.map((step) => step.id);

      const { data: insertedRunSteps, error: insertedRunStepsError } = await supabase
        .from("closing_run_steps")
        .select("id, template_step_id")
        .eq("closing_run_id", run.id)
        .in("template_step_id", templateStepIds);

      if (insertedRunStepsError) {
        throw new Error(insertedRunStepsError.message || "Failed to load run steps");
      }

      const { data: templateSubsteps, error: templateSubstepsError } = await supabase
        .from("checklist_template_substeps")
        .select("*")
        .in("template_step_id", templateStepIds)
        .order("sort_order", { ascending: true });

      if (templateSubstepsError) {
        throw new Error(templateSubstepsError.message || "Failed to load template substeps");
      }

      const runStepIdByTemplateStepId = new Map(
        (insertedRunSteps ?? []).map((runStep) => [runStep.template_step_id, runStep.id])
      );

      const runSubstepsToInsert = (templateSubsteps ?? [])
        .map((substep) => {
          const runStepId = runStepIdByTemplateStepId.get(substep.template_step_id);

          if (!runStepId) return null;

          return {
            id: `${run.id}_${substep.id}`,
            run_step_id: runStepId,
            label: substep.label,
            description: substep.description,
            sort_order: substep.sort_order,
            is_complete: false,
          };
        })
        .filter(Boolean);

      if (runSubstepsToInsert.length > 0) {
        const { error: insertRunSubstepsError } = await supabase
          .from("checklist_run_substeps")
          .insert(runSubstepsToInsert);

        if (insertRunSubstepsError) {
          throw new Error(insertRunSubstepsError.message || "Failed to create run substeps");
        }
      }
    }

    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create closing run",
      },
      { status: 500 }
    );
  }
}