

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST() {
  try {
    const supabase = createClient();

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const day = now.getDay(); // 4 = Thursday

    // use opening_first_day on Thursdays, otherwise standard
    const templateId = day === 4 ? "opening_first_day" : "opening_standard";

    // create opening run
    const { data: run, error: runError } = await supabase
      .from("opening_runs")
      .insert({
        run_date: today,
        template_id: templateId,
        status: "draft",
      })
      .select()
      .single();

    if (runError) {
      throw runError;
    }

    // fetch template steps
    const { data: templateSteps, error: stepsError } = await supabase
      .from("checklist_template_steps")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (stepsError) {
      throw stepsError;
    }

    // insert run steps
    const stepsToInsert = (templateSteps ?? []).map((step) => ({
      opening_run_id: run.id,
      template_step_id: step.id,
      label_snapshot: step.label,
      step_type: step.step_type,
      tool_key: step.tool_key,
      sort_order: step.sort_order,
      is_complete: false,
    }));

    const { error: insertStepsError } = await supabase
      .from("opening_run_steps")
      .insert(stepsToInsert);

    if (insertStepsError) {
      throw insertStepsError;
    }

    const detailTemplateSteps = (templateSteps ?? []).filter(
      (step) => step.step_type === "detail"
    );

    if (detailTemplateSteps.length > 0) {
      const templateStepIds = detailTemplateSteps.map((step) => step.id);

      const { data: insertedRunSteps, error: insertedRunStepsError } = await supabase
        .from("opening_run_steps")
        .select("id, template_step_id")
        .eq("opening_run_id", run.id)
        .in("template_step_id", templateStepIds);

      if (insertedRunStepsError) {
        throw insertedRunStepsError;
      }

      const { data: templateSubsteps, error: templateSubstepsError } = await supabase
        .from("checklist_template_substeps")
        .select("*")
        .in("template_step_id", templateStepIds)
        .order("sort_order", { ascending: true });

      if (templateSubstepsError) {
        throw templateSubstepsError;
      }

      const runStepIdByTemplateStepId = new Map(
        (insertedRunSteps ?? []).map((runStep) => [runStep.template_step_id, runStep.id])
      );

      const runSubstepsToInsert = (templateSubsteps ?? [])
        .map((substep) => {
          const runStepId = runStepIdByTemplateStepId.get(substep.template_step_id);

          if (!runStepId) {
            return null;
          }

          return {
            id: `${run.id}_${substep.id}`,
            run_step_id: runStepId,
            label: substep.label,
            description: substep.description,
            sort_order: substep.sort_order,
            is_complete: false,
          };
        })
        .filter((value): value is {
          id: string;
          run_step_id: string;
          label: string;
          description: string | null;
          sort_order: number;
          is_complete: boolean;
        } => Boolean(value));

      if (runSubstepsToInsert.length > 0) {
        const { error: insertRunSubstepsError } = await supabase
          .from("checklist_run_substeps")
          .insert(runSubstepsToInsert);

        if (insertRunSubstepsError) {
          throw insertRunSubstepsError;
        }
      }
    }

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create opening run",
      },
      { status: 500 }
    );
  }
}