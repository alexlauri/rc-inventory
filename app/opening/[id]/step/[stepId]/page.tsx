"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type RunSubstep = {
  id: string;
  label: string;
  description: string | null;
  is_complete: boolean;
  sort_order: number;
};

export default function OpeningStepDetailPage() {
  const params = useParams();
  const router = useRouter();

  const openingId = params.id as string;
  const stepId = params.stepId as string;

  const [substeps, setSubsteps] = useState<RunSubstep[]>([]);
  const [loading, setLoading] = useState(true);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    void load();
  }, [openingId, stepId]);

  async function load() {
    setLoading(true);

    const res = await fetch(`/api/opening/${openingId}/step/${stepId}`);

    if (!res.ok) {
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSubsteps(data.substeps || []);
    setLoading(false);
  }

  function goBackToChecklist() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `opening_step_scroll_${openingId}`,
        stepId
      );
    }

    router.push(`/opening/${openingId}`);
  }

  async function toggleSubstep(substep: RunSubstep) {
    hasInteractedRef.current = true;

    const res = await fetch(`/api/opening/${openingId}/step/${stepId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        substepId: substep.id,
        is_complete: !substep.is_complete,
      }),
    });

    if (!res.ok) return;

    if (substep.is_complete) {
      await fetch(`/api/opening/${openingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_id: stepId,
          is_complete: false,
        }),
      });
    }

    const data = await res.json();

    setSubsteps((prev) =>
      prev.map((s) => (s.id === data.substep.id ? data.substep : s))
    );
  }

  const allComplete =
    substeps.length > 0 && substeps.every((s) => s.is_complete);

  useEffect(() => {
    if (!allComplete) return;
    if (!hasInteractedRef.current) return;

    async function completeAndReturn() {
      await fetch(`/api/opening/${openingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_id: stepId,
          is_complete: true,
        }),
      });

      goBackToChecklist();
    }

    void completeAndReturn();
  }, [allComplete, openingId, stepId]);

  return (
    <div className="p-4 space-y-4 pb-32">
      <button
        onClick={goBackToChecklist}
        className="text-sm text-gray-500"
      >
        ← Back
      </button>

      <h1 className="text-xl font-semibold">Step details</h1>

      {loading && (
        <div className="text-sm text-gray-500">Loading…</div>
      )}

      {!loading && (
        <div className="space-y-3">
          {substeps.map((substep) => (
            <button
              key={substep.id}
              type="button"
              onClick={() => toggleSubstep(substep)}
              className={`
                w-full text-left rounded-xl border p-4
                ${substep.is_complete
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-gray-200"}
              `}
            >
              <div className="font-medium">
                {substep.label}
              </div>

              {substep.description && (
                <div className="text-sm text-gray-500 mt-1">
                  {substep.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}