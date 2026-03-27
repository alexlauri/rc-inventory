"use client";

import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChecklistStepCard from "@/app/components/ChecklistStepCard";
import StickySubmitButton from "@/app/components/StickySubmitButton";
import { H2 } from "@/app/components/Type";

import ChecklistToolsHeader from "@/app/components/ChecklistToolsHeader";

type OpeningRunStep = {
  id: string;
  label_snapshot: string;
  step_type?: string | null;
  tool_key: string | null;
  is_complete: boolean;
  sort_order: number;
};

type OpeningRun = {
  id: string;
  status?: string | null;
  cash_count_total?: number | null;
  report_copied?: boolean | null;
  report_copied_by_name?: string | null;
  submitted_by_name?: string | null;
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
  const [cashCountTotal, setCashCountTotal] = useState<number | null>(null);
  const [copyingReport, setCopyingReport] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const [reportCopiedJustNow, setReportCopiedJustNow] = useState(false);

  useEffect(() => {
    async function loadOpeningSteps() {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(`/api/opening/${openingRunId}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const text = await res.text();
        let json: { error?: string; steps?: OpeningRunStep[]; run?: OpeningRun | null } = {};

        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load opening checklist");
        }

        setSteps(json.steps ?? []);
        setCashCountTotal(json.run?.cash_count_total ?? null);
        setReportCopied(Boolean(json.run?.report_copied));
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

  // lightweight live sync — refresh opening run every 2s
  useEffect(() => {
    if (!openingRunId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/opening/${openingRunId}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const text = await res.text();

        let json: { steps?: OpeningRunStep[]; run?: OpeningRun | null } = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (json.steps) {
          setSteps(json.steps);
        }
        if (json.run) {
          setCashCountTotal(json.run.cash_count_total ?? null);
          setReportCopied(Boolean(json.run.report_copied));
        }
      } catch {
        // silently ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [openingRunId]);

  const featuredSteps = useMemo(() => {
    const cashStep = steps.find((step) => step.tool_key === "cash_count") ?? null;
    return { cashStep };
  }, [steps]);

  const checklistSteps = useMemo(() => {
    return steps.filter((step) => step.tool_key !== "cash_count");
  }, [steps]);

  const reportDateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
  }, []);

  const allStepsComplete = useMemo(() => {
    return steps.length > 0 && steps.every((step) => step.is_complete);
  }, [steps]);

  const openingReportMessage = useMemo(() => {
    if (cashCountTotal == null) {
      return "";
    }

    return `${reportDateLabel} - cash count: $${cashCountTotal.toFixed(2)}`;
  }, [cashCountTotal, reportDateLabel]);

  async function handleCopyReportMessage() {
    try {
      if (!openingReportMessage) {
        throw new Error("No report message available yet");
      }

      setCopyingReport(true);
      setError(null);

      await navigator.clipboard.writeText(openingReportMessage);

      const storedUser = typeof window !== "undefined"
        ? JSON.parse(window.localStorage.getItem("rc_user") || "null")
        : null;

      await fetch(`/api/opening/${openingRunId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_copied: true,
          report_copied_by_name: storedUser?.name ?? null,
        }),
      });

      setReportCopied(true);
      setReportCopiedJustNow(true);

      window.setTimeout(() => {
        setReportCopiedJustNow(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy report message");
    } finally {
      setCopyingReport(false);
    }
  }

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
    <main
      className="min-h-screen w-full space-y-6 px-6 pb-28 pt-4"
      style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
    >
      <ChecklistToolsHeader
        title="Opening"
        backHref="/"
        onRunInventory={() => {}}
        onCountCash={
          featuredSteps.cashStep
            ? () => {
                void handleToggleStep(featuredSteps.cashStep!);
              }
            : undefined
        }
        onSendReport={() => void handleCopyReportMessage()}
        inventoryStatus="pending"
        cashStatus={
          featuredSteps.cashStep
            ? savingStepId === featuredSteps.cashStep.id
              ? "saving"
              : featuredSteps.cashStep.is_complete
              ? "complete"
              : "pending"
            : "pending"
        }
        reportStatus={
          copyingReport
            ? "saving"
            : reportCopied
            ? "complete"
            : "pending"
        }
        inventoryLabel=""
        cashLabel={
          cashCountTotal != null
            ? `$${cashCountTotal.toFixed(2)}`
            : featuredSteps.cashStep?.is_complete
            ? "Complete"
            : "$0.00"
        }
        reportLabel={
          copyingReport
            ? "Copying..."
            : reportCopiedJustNow
            ? "Copied!"
            : reportCopied
            ? "Copied"
            : "Copy Message"
        }
        showInventory={false}
        showCash={Boolean(featuredSteps.cashStep)}
        showReport={Boolean(featuredSteps.cashStep && featuredSteps.cashStep.is_complete && cashCountTotal != null)}
        cashDisabled={featuredSteps.cashStep ? savingStepId === featuredSteps.cashStep.id : false}
        reportDisabled={copyingReport || !openingReportMessage}
      />

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading opening checklist...</div>
      ) : (
        <div className="space-y-6">
          {steps.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
              No opening steps yet.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <H2 className="mb-5 pt-3 text-[var(--color-primary,#004DEA)]">
                  Opening Checklist
                </H2>

                {checklistSteps.map((step) => {
                  if (!stepRefs.current[step.id]) {
                    stepRefs.current[step.id] = createRef<HTMLDivElement>();
                  }

                  return (
                    <div key={step.id} ref={stepRefs.current[step.id]}>
                      <ChecklistStepCard
                        title={step.label_snapshot}
                        subtitle={
                          step.step_type === "detail"
                            ? "Tap to open details"
                            : step.tool_key
                            ? "Tap to open tool"
                            : null
                        }
                        status={
                          savingStepId === step.id
                            ? "saving"
                            : step.is_complete
                            ? "complete"
                            : "pending"
                        }
                        onClick={() => handleToggleStep(step)}
                        disabled={savingStepId === step.id}
                        activeScale={!step.tool_key}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {!loading && (
        <StickySubmitButton
          label={submitting ? "Submitting..." : "Submit Opening Checklist"}
          onClick={submitOpeningChecklist}
          disabled={submitting || !allStepsComplete}
        />
      )}
    </main>
  );
}