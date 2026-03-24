

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; stepId: string }> }
) {
  const { id, stepId } = await context.params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("checklist_run_substeps")
    .select("id, label, description, is_complete, sort_order")
    .eq("run_step_id", stepId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ substeps: data ?? [] });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; stepId: string }> }
) {
  const { id, stepId } = await context.params;
  const supabase = createClient();
  const body = await req.json();
  const { substepId, is_complete } = body;

  const { data, error } = await supabase
    .from("checklist_run_substeps")
    .update({ is_complete })
    .eq("id", substepId)
    .eq("run_step_id", stepId)
    .select("id, label, description, is_complete, sort_order")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ substep: data });
}