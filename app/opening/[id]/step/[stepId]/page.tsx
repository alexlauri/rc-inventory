"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/app/components/PageHeader";
import ChecklistStepCard from "@/app/components/ChecklistStepCard";
import { Subtle } from "@/app/components/Type";

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

  // lightweight live sync for substeps
  useEffect(() => {
    if (!openingId || !stepId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/opening/${openingId}/step/${stepId}?t=${Date.now()}`,
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
  }, [openingId, stepId]);

  async function load() {
    setLoading(true);

    const res = await fetch(`/api/opening/${openingId}/step/${stepId}?t=${Date.now()}`, {
      cache: "no-store",
    });

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
    <div
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen -mt-2"
      style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
    >
      <div className="p-6 space-y-4 pb-32">
        <div
          className="space-y-3"
          style={{ color: "var(--color-primary, #004DEA)" }}
        >
          <PageHeader title="Step details" backHref={`/opening/${openingId}`} />
        </div>

        {loading && (
          <div className="text-sm text-gray-500">Loading…</div>
        )}

        {!loading && (
          <div className="space-y-3">
            {substeps.map((substep) => (
              <ChecklistStepCard
                key={substep.id}
                title={substep.label}
                subtitle={substep.description || undefined}
                status={substep.is_complete ? "complete" : "pending"}
                showArrow={false}
                showSubtitle={true}
                onClick={() => toggleSubstep(substep)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}