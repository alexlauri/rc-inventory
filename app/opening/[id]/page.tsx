"use client";

import { createRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type OpeningRunStep = {
  id: string;
  label_snapshot: string;
  step_type?: string | null;
  tool_key: string | null;
  is_complete: boolean;
  sort_order: number;
};

export default function OpeningRunPage() {
  const params = useParams<{ id: string }>();
  const openingRunId = params?.id;
  const router = useRouter();
  const stepRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});

  const [steps, setSteps] = useState<OpeningRunStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadOpeningSteps() {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(`/api/opening/${openingRunId}`);
        const text = await res.text();
        let json: { error?: string; steps?: OpeningRunStep[] } = {};

        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load opening checklist");
        }

        setSteps(json.steps ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load opening checklist");
      } finally {
        setLoading(false);
      }
    }

    if (openingRunId) {
      loadOpeningSteps();
    }
  }, [openingRunId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!steps.length) return;

    const stepIdToScroll = window.sessionStorage.getItem(`opening_step_scroll_${openingRunId}`);
    if (!stepIdToScroll) return;

    const timeout = window.setTimeout(() => {
      const ref = stepRefs.current[stepIdToScroll];
      const el = ref?.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const target = rect.top + scrollTop - 16;

      window.scrollTo({
        top: Math.max(target, 0),
        behavior: "smooth",
      });

      window.sessionStorage.removeItem(`opening_step_scroll_${openingRunId}`);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [steps, openingRunId]);

  const allStepsComplete = useMemo(() => {
    return steps.length > 0 && steps.every((step) => step.is_complete);
  }, [steps]);

  async function handleToggleStep(step: OpeningRunStep) {
    if (step.step_type === "detail") {
      router.push(`/opening/${openingRunId}/step/${step.id}`);
      return;
    }

    if (step.tool_key === "cash_count") {
      router.push(`/opening/${openingRunId}/cash`);
      return;
    }

    if (step.tool_key) return;

    try {
      setError(null);
      setSavingStepId(step.id);

      const storedUser = window.localStorage.getItem("rc_user");

      if (!storedUser) {
        throw new Error("No logged in user found");
      }

      const user = JSON.parse(storedUser) as { id: string; name: string };

      const res = await fetch(`/api/opening/${openingRunId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step_id: step.id,
          is_complete: !step.is_complete,
          completed_by_user_id: user.id,
          completed_by_name: user.name,
        }),
      });

      const text = await res.text();
      let json: { error?: string; step?: OpeningRunStep } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.step) {
        throw new Error(json.error || "Failed to update opening step");
      }

      setSteps((prev) =>
        prev.map((currentStep) =>
          currentStep.id === step.id ? json.step! : currentStep
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update opening step");
    } finally {
      setSavingStepId(null);
    }
  }

  async function submitOpeningChecklist() {
    try {
      setSubmitting(true);
      setError(null);

      const storedUser = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("rc_user") || "null")
        : null;

      if (!storedUser?.id || !storedUser?.name) {
        throw new Error("No logged in user found");
      }

      const res = await fetch(`/api/opening/${openingRunId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submitted_by_user_id: storedUser.id,
          submitted_by_name: storedUser.name,
        }),
      });

      const text = await res.text();
      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to submit opening checklist");
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit opening checklist");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 pb-28">
      <div className="space-y-1 pt-4">
        <Link href="/" className="text-sm text-gray-600 underline">
          ← Back to Operations
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Opening Checklist</h1>
        <p className="text-sm text-gray-500">Tap each item in the checklist to complete it and get ready for service.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading opening checklist...</div>
      ) : (
        <div className="space-y-3">
          {steps.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
              No opening steps yet.
            </div>
          ) : (
            steps.map((step) => {
              if (!stepRefs.current[step.id]) {
                stepRefs.current[step.id] = createRef<HTMLDivElement>();
              }

              return (
                <div key={step.id} ref={stepRefs.current[step.id]}>
                  <button
                    type="button"
                    onClick={() => handleToggleStep(step)}
                    disabled={savingStepId === step.id}
                    className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm ${
                      !step.tool_key ? "active:scale-[0.99]" : ""
                    } disabled:opacity-100`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{step.label_snapshot}</div>
                        {step.step_type === "detail" ? (
                          <div className="text-sm text-gray-500">Tap to open details</div>
                        ) : step.tool_key ? (
                          <div className="text-sm text-gray-500">Tap to open tool</div>
                        ) : null}
                      </div>

                      <div
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          step.is_complete
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        {savingStepId === step.id
                          ? "Saving..."
                          : step.is_complete
                          ? "Complete"
                          : "Pending"}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
      {!loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
            <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
              <button
                type="button"
                onClick={submitOpeningChecklist}
                disabled={submitting || !allStepsComplete}
                className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Opening Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}