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

export default function ClosingStepDetailPage() {
  const params = useParams();
  const router = useRouter();

  const closingId = params.id as string;
  const stepId = params.stepId as string;

  const [substeps, setSubsteps] = useState<RunSubstep[]>([]);
  const [loading, setLoading] = useState(true);
  const hasInteractedRef = useRef(false);

  function goBackToChecklist() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `closing_step_scroll_${closingId}`,
        stepId
      );
    }

    router.push(`/closing/${closingId}`);
  }

  useEffect(() => {
    load();
  }, [closingId, stepId]);

  useEffect(() => {
    if (!closingId || !stepId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/closing/${closingId}/step/${stepId}?t=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!res.ok) return;

        const data = await res.json();
        setSubsteps(data.substeps || []);
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [closingId, stepId]);

  async function load() {
    setLoading(true);

    const res = await fetch(
      `/api/closing/${closingId}/step/${stepId}?t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSubsteps(data.substeps || []);
    setLoading(false);
  }

  async function toggleSubstep(substep: RunSubstep) {
    hasInteractedRef.current = true;

    const res = await fetch(
      `/api/closing/${closingId}/step/${stepId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substepId: substep.id,
          is_complete: !substep.is_complete,
        }),
      }
    );

    if (!res.ok) return;

    if (substep.is_complete) {
      await fetch(`/api/closing/${closingId}`, {
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
      prev.map((s) =>
        s.id === data.substep.id ? data.substep : s
      )
    );
  }

  const allComplete =
    substeps.length > 0 && substeps.every((s) => s.is_complete);

  useEffect(() => {
    if (!allComplete) return;
    if (!hasInteractedRef.current) return;

    async function completeAndReturn() {
      await fetch(`/api/closing/${closingId}`, {
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
  }, [allComplete, closingId, stepId, router]);

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
          {substeps.map((sub) => (
            <button
              key={sub.id}
              onClick={() => toggleSubstep(sub)}
              className={`
                w-full text-left rounded-xl border p-4
                ${sub.is_complete
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-gray-200"}
              `}
            >
              <div className="font-medium">
                {sub.label}
              </div>

              {sub.description && (
                <div className="text-sm text-gray-500 mt-1">
                  {sub.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}