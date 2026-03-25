"use client";

import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ClosingRunStep = {
  id: string;
  label_snapshot: string;
  step_type?: string | null;
  tool_key: string | null;
  is_complete: boolean;
  sort_order: number;
};

type ClosingRun = {
  id: string;
  status?: string | null;
  inventory_report_message?: string | null;
  cash_count_total?: number | null;
  report_copied?: boolean | null;
  report_copied_by_name?: string | null;
  submitted_by_name?: string | null;
};

export default function ClosingRunPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [steps, setSteps] = useState<ClosingRunStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryReportMessage, setInventoryReportMessage] = useState("");
  const [cashCountTotal, setCashCountTotal] = useState<number | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [copyingReport, setCopyingReport] = useState(false);
  const [reportCopiedJustNow, setReportCopiedJustNow] = useState(false);
  const sendReportRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});

  useEffect(() => {
    async function loadSteps() {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(`/api/closing/${id}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const text = await res.text();

        let json: { error?: string; steps?: ClosingRunStep[]; run?: ClosingRun | null } = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load closing steps");
        }

        setSteps(json.steps ?? []);
        setInventoryReportMessage(json.run?.inventory_report_message ?? "");
        setCashCountTotal(json.run?.cash_count_total ?? null);
        setReportCopied(Boolean(json.run?.report_copied));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load closing steps");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadSteps();
    }
  }, [id]);

  // lightweight live sync — refresh closing run every 2s
  useEffect(() => {
    if (!id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/closing/${id}?t=${Date.now()}`, {
          cache: "no-store",
        });
        const text = await res.text();

        let json: { steps?: ClosingRunStep[]; run?: ClosingRun | null } = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (json.steps) {
          setSteps(json.steps);
        }

        if (json.run) {
          setInventoryReportMessage(json.run.inventory_report_message ?? "");
          setCashCountTotal(json.run.cash_count_total ?? null);
          setReportCopied(Boolean(json.run.report_copied));
        }
      } catch {
        // silently ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!inventoryReportMessage) return;
    if (!steps.some((step) => step.tool_key === "inventory_count")) return;

    const shouldScroll =
      window.sessionStorage.getItem(`inventory_report_scroll_${id}`) === "true";

    if (!shouldScroll) return;

    const timeout = window.setTimeout(() => {
      const el = sendReportRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;

      // leave enough room so the copy button clears the floating submit bar
      const TARGET_BOTTOM_PADDING = 100;
      const target = rect.bottom + scrollTop - viewportHeight + TARGET_BOTTOM_PADDING;

      window.scrollTo({
        top: Math.max(target, 0),
        behavior: "smooth",
      });

      window.sessionStorage.removeItem(`inventory_report_scroll_${id}`);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [inventoryReportMessage, steps, id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!steps.length) return;

    const stepIdToScroll = window.sessionStorage.getItem(`closing_step_scroll_${id}`);
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

      window.sessionStorage.removeItem(`closing_step_scroll_${id}`);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [steps, id]);


  const inventoryStepComplete = useMemo(() => {
    return steps.some((step) => step.tool_key === "inventory_count" && step.is_complete);
  }, [steps]);

  const cashStepComplete = useMemo(() => {
    return steps.some((step) => step.tool_key === "cash_count" && step.is_complete);
  }, [steps]);


  const featuredSteps = useMemo(() => {
    const inventoryStep = steps.find((step) => step.tool_key === "inventory_count") ?? null;
    const cashStep = steps.find((step) => step.tool_key === "cash_count") ?? null;

    return { inventoryStep, cashStep };
  }, [steps]);

  const hasInventoryStep = Boolean(featuredSteps.inventoryStep);
  const hasCashStep = Boolean(featuredSteps.cashStep);
  const reportDateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
  }, []);

  const checklistSteps = useMemo(() => {
    return steps.filter(
      (step) => step.tool_key !== "inventory_count" && step.tool_key !== "cash_count"
    );
  }, [steps]);

  const combinedReportMessage = useMemo(() => {
    if (hasInventoryStep && hasCashStep) {
      if (!inventoryReportMessage || cashCountTotal == null) {
        return "";
      }

      return `${reportDateLabel}\n\n${inventoryReportMessage}\n\ncash count: $${cashCountTotal.toFixed(2)}`;
    }

    if (hasCashStep && cashCountTotal != null) {
      return `${reportDateLabel} - cash count: $${cashCountTotal.toFixed(2)}`;
    }

    if (hasInventoryStep && inventoryReportMessage) {
      return `${reportDateLabel}\n\n${inventoryReportMessage}`;
    }

    return "";
  }, [hasInventoryStep, hasCashStep, inventoryReportMessage, cashCountTotal, reportDateLabel]);

  const allStepsComplete = useMemo(() => {
    const baseStepsComplete = steps.length > 0 && steps.every((step) => step.is_complete);

    if (!baseStepsComplete) {
      return false;
    }

    if (!hasInventoryStep && !hasCashStep) {
      return true;
    }

    if (hasInventoryStep && !inventoryStepComplete) {
      return false;
    }

    if (hasCashStep && !cashStepComplete) {
      return false;
    }

    return Boolean(combinedReportMessage) && reportCopied;
  }, [
    steps,
    hasInventoryStep,
    hasCashStep,
    inventoryStepComplete,
    cashStepComplete,
    combinedReportMessage,
    reportCopied,
  ]);

  async function handleToggleStep(step: ClosingRunStep) {
    if (step.step_type === "detail") {
      router.push(`/closing/${id}/step/${step.id}`);
      return;
    }

    if (step.tool_key === "cash_count") {
      router.push(`/closing/${id}/cash`);
      return;
    }

    if (step.tool_key === "inventory_count") {
        try {
          setError(null);
          setSavingStepId(step.id);
      
          const res = await fetch("/api/counts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              closing_run_id: id,
            }),
          });
      
          const text = await res.text();
          let json: { error?: string; count?: { id: string } } = {};
      
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = {};
          }
      
          if (!res.ok || !json.count?.id) {
            throw new Error(json.error || "Failed to create inventory count");
          }
      
          router.push(`/counts/${json.count.id}?closing_run_id=${id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create inventory count");
        } finally {
          setSavingStepId(null);
        }
        return;
      }

    try {
      setError(null);
      setSavingStepId(step.id);

      const storedUser = window.localStorage.getItem("rc_user");

      if (!storedUser) {
        throw new Error("No logged in user found");
      }

      const user = JSON.parse(storedUser) as { id: string; name: string };

      const res = await fetch(`/api/closing/${id}`, {
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
      let json: { error?: string; step?: ClosingRunStep } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.step) {
        throw new Error(json.error || "Failed to update closing step");
      }

      setSteps((prev) =>
        prev.map((currentStep) =>
          currentStep.id === step.id ? json.step! : currentStep
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update closing step");
    } finally {
      setSavingStepId(null);
    }
  }

  async function handleCopyReportMessage() {
    try {
      if (!combinedReportMessage) {
        throw new Error("No report message available yet");
      }

      setCopyingReport(true);
      setError(null);

      await navigator.clipboard.writeText(combinedReportMessage);
      const storedUser = typeof window !== "undefined"
        ? JSON.parse(window.localStorage.getItem("rc_user") || "null")
        : null;

      await fetch(`/api/closing/${id}`, {
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

  async function submitClosingChecklist() {
    try {
      setSubmitting(true);
      setError(null);

      const storedUser = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("rc_user") || "null")
        : null;

      if (!storedUser?.id || !storedUser?.name) {
        throw new Error("No logged in user found");
      }

      const res = await fetch(`/api/closing/${id}`, {
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
        throw new Error(json.error || "Failed to submit closing checklist");
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit closing checklist");
    } finally {
      setSubmitting(false);
    }
  }

  function isStepVisuallyComplete(step: ClosingRunStep) {
    if (step.tool_key === "inventory_count" && inventoryReportMessage) {
      return true;
    }

    return step.is_complete;
  }

  function getInventoryProgressLabel() {
    if (!featuredSteps.inventoryStep) {
      return "0/0";
    }

    return inventoryStepComplete ? "Complete" : "0/34";
  }

  function getCashProgressLabel() {
    if (!featuredSteps.cashStep) {
      return "$0.00";
    }

    if (cashCountTotal != null) {
      return `$${cashCountTotal.toFixed(2)}`;
    }

    return featuredSteps.cashStep.is_complete ? "Complete" : "$0.00";
  }

  function renderStatusPill(step: ClosingRunStep) {
    const complete = isStepVisuallyComplete(step);

    return (
      <div
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
          complete
            ? "border border-green-200 bg-green-50 text-green-700"
            : "border border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {savingStepId === step.id ? "Saving..." : complete ? "Complete" : "Pending"}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4 space-y-6 pb-28">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center text-sm text-gray-500 underline"
        >
          Back
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Closing</h1>
          <p className="text-sm text-gray-500">Tap each item in the checklist to complete it and close out service.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {loading ? (
        <div className="text-sm text-gray-600">Loading checklist...</div>
      ) : (
        <div className="space-y-6">
          {(featuredSteps.inventoryStep || featuredSteps.cashStep) && (
            <div className={`grid gap-3 ${hasInventoryStep && hasCashStep ? "grid-cols-2" : "grid-cols-1"}`}>
              {featuredSteps.inventoryStep && (
                <button
                  type="button"
                  onClick={() => handleToggleStep(featuredSteps.inventoryStep)}
                  disabled={savingStepId === featuredSteps.inventoryStep.id}
                  className="min-h-[180px] rounded-2xl border bg-white p-5 text-left active:scale-[0.99] disabled:opacity-100"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="space-y-1">
                      <div className="text-2xl font-semibold">Run Inventory</div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-5xl font-semibold leading-none">
                        {getInventoryProgressLabel()}
                      </div>
                      {renderStatusPill(featuredSteps.inventoryStep)}
                    </div>
                  </div>
                </button>
              )}

              {featuredSteps.cashStep && (
                <button
                  type="button"
                  onClick={() => handleToggleStep(featuredSteps.cashStep)}
                  disabled={savingStepId === featuredSteps.cashStep.id}
                  className="min-h-[180px] rounded-2xl border bg-white p-5 text-left active:scale-[0.99] disabled:opacity-100"
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="space-y-1">
                      <div className="text-2xl font-semibold">Count cash</div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-5xl font-semibold leading-none">
                        {getCashProgressLabel()}
                      </div>
                      {renderStatusPill(featuredSteps.cashStep)}
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {((hasInventoryStep && inventoryStepComplete) || !hasInventoryStep) &&
            ((hasCashStep && cashStepComplete) || !hasCashStep) &&
            Boolean(combinedReportMessage) && (
              <div ref={sendReportRef} className="w-full rounded-xl border bg-white p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">Send Report</div>
                    <div className="text-sm text-gray-500">
                      Copy the report and text it to Nikki and Alex.
                    </div>
                  </div>

                  <div
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      reportCopied
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : "border border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {reportCopied ? "Complete" : "Pending"}
                  </div>
                </div>


                <button
                  type="button"
                  onClick={handleCopyReportMessage}
                  disabled={copyingReport || !combinedReportMessage}
                  className={`mt-4 w-full rounded-xl border px-4 py-3 font-medium disabled:opacity-50 ${
                    reportCopied ? "border-green-200 bg-green-50 text-green-700" : ""
                  }`}
                >
                  {copyingReport
                    ? "Copying..."
                    : reportCopiedJustNow
                    ? "Copied!"
                    : reportCopied
                    ? "Copied"
                    : "Copy Message"}
                </button>
              </div>
            )}

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Checklist</h2>

            {checklistSteps.map((step) => {
              if (!stepRefs.current[step.id]) {
                stepRefs.current[step.id] = createRef<HTMLDivElement>();
              }

              return (
                <div key={step.id} ref={stepRefs.current[step.id]} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleToggleStep(step)}
                    disabled={savingStepId === step.id}
                    className="w-full rounded-xl border bg-white p-4 text-left active:scale-[0.99] disabled:opacity-100"
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

                      {renderStatusPill(step)}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      )}
      {!loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
            <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
              <button
                type="button"
                onClick={submitClosingChecklist}
                disabled={submitting || !allStepsComplete}
                className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Closing Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}