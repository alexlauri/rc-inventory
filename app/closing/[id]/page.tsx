"use client";

import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
// import FeaturedToolTile from "@/app/components/FeaturedToolTile";
import ChecklistStepCard from "@/app/components/ChecklistStepCard";
import StickySubmitButton from "@/app/components/StickySubmitButton";
// import PageHeader from "@/app/components/PageHeader";
import ChecklistToolsHeader from "@/app/components/ChecklistToolsHeader";
import { H2 } from "@/app/components/Type";
import { clientApiUrl, fetchErrorToUserMessage } from "@/lib/client-fetch";

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
  checklist_key?: string | null;
  status?: string | null;
  inventory_report_message?: string | null;
  cash_count_total?: number | null;
  report_copied?: boolean | null;
  report_copied_by_name?: string | null;
  submitted_by_name?: string | null;
  inventory_count_id?: string | null;
};

export default function ClosingRunPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [steps, setSteps] = useState<ClosingRunStep[]>([]);
  const [closingRun, setClosingRun] = useState<ClosingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryReportMessage, setInventoryReportMessage] = useState("");
  const [cashCountTotal, setCashCountTotal] = useState<number | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [copyingReport, setCopyingReport] = useState(false);
  const [reportCopiedJustNow, setReportCopiedJustNow] = useState(false);
  const [inventoryTotalCount, setInventoryTotalCount] = useState<number>(0);
  const [inventorySavedCount, setInventorySavedCount] = useState<number>(0);
  // inventoryCountIdRef no longer needed
  useEffect(() => {

    async function loadViaDedicatedEndpoint() {
      const res = await fetch(
        clientApiUrl(`/api/closing/${id}/inventory-progress?t=${Date.now()}`),
        {
          cache: "no-store",
        }
      );
      const text = await res.text();

      let json: {
        error?: string;
        inventoryTotalCount?: number;
        inventorySavedCount?: number;
      } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to load inventory progress");
      }

      const total = json.inventoryTotalCount ?? 0;
      const saved = json.inventorySavedCount ?? 0;

      if (total === 0 && saved === 0) {
        throw new Error("Inventory progress endpoint returned 0/0");
      }

      setInventoryTotalCount(total);
      setInventorySavedCount(saved);
    }

    async function loadViaFallbackApis() {
      const itemsRes = await fetch(clientApiUrl(`/api/items?t=${Date.now()}`), {
        cache: "no-store",
      });
      const itemsText = await itemsRes.text();

      let itemsJson: {
        error?: string;
        items?: Array<{ id: string }>;
      } = {};

      try {
        itemsJson = itemsText ? JSON.parse(itemsText) : {};
      } catch {
        itemsJson = {};
      }

      if (!itemsRes.ok) {
        throw new Error(itemsJson.error || "Failed to load inventory items");
      }

      const items = itemsJson.items ?? [];
      setInventoryTotalCount(items.length);

      const countRes = await fetch(
        clientApiUrl(`/api/counts?closing_run_id=${id}&t=${Date.now()}`),
        {
          cache: "no-store",
        }
      );
      const countText = await countRes.text();

      let countJson: {
        error?: string;
        count?: { id?: string | null } | null;
        countId?: string | null;
        counts?: Array<{ id?: string | null }>;
      } = {};

      try {
        countJson = countText ? JSON.parse(countText) : {};
      } catch {
        countJson = {};
      }

      const countId =
        countJson.count?.id ?? countJson.countId ?? countJson.counts?.[0]?.id ?? null;

      if (!countId) {
        setInventorySavedCount(0);
        return;
      }

      const linesRes = await fetch(
        clientApiUrl(`/api/counts/${countId}?t=${Date.now()}`),
        {
          cache: "no-store",
        }
      );
      const linesText = await linesRes.text();

      let linesJson: {
        error?: string;
        savedCount?: number;
        totalCount?: number;
        lines?: Array<{
          id: string;
          is_saved?: boolean | null;
          isSaved?: boolean | null;
          created_at?: string | null;
          createdAt?: string | null;
          updated_at?: string | null;
          updatedAt?: string | null;
        }>;
      } = {};

      try {
        linesJson = linesText ? JSON.parse(linesText) : {};
      } catch {
        linesJson = {};
      }

      if (!linesRes.ok) {
        throw new Error(linesJson.error || "Failed to load inventory lines");
      }

      if (typeof linesJson.totalCount === "number") {
        setInventoryTotalCount(linesJson.totalCount);
      }

      if (typeof linesJson.savedCount === "number") {
        setInventorySavedCount(linesJson.savedCount);
        return;
      }

      const lines = linesJson.lines ?? [];
      setInventorySavedCount(
        lines.filter((line) => {
          const explicitSaved = Boolean(line.is_saved ?? line.isSaved);
          const createdAt = line.created_at ?? line.createdAt ?? null;
          const updatedAt = line.updated_at ?? line.updatedAt ?? null;
          const timestampSaved = Boolean(createdAt && updatedAt && createdAt !== updatedAt);
          return explicitSaved || timestampSaved;
        }).length
      );
    }

    async function loadInventoryProgress() {
      if (!id) return;

      try {
        await loadViaDedicatedEndpoint();
      } catch {
        try {
          await loadViaFallbackApis();
        } catch {
          setInventoryTotalCount(0);
          setInventorySavedCount(0);
        }
      }
    }

    if (id) {
      void loadInventoryProgress();
    }

    const interval = window.setInterval(() => {
      void loadInventoryProgress();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [id]);

  const sendReportRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});

  useEffect(() => {
    async function loadSteps() {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(clientApiUrl(`/api/closing/${id}?t=${Date.now()}`), {
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
        setClosingRun(json.run ?? null);
        setInventoryReportMessage(json.run?.inventory_report_message ?? "");
        setCashCountTotal(json.run?.cash_count_total ?? null);
        setReportCopied(Boolean(json.run?.report_copied));
      } catch (err) {
        setError(fetchErrorToUserMessage(err));
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
        const res = await fetch(clientApiUrl(`/api/closing/${id}?t=${Date.now()}`), {
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
          setClosingRun(json.run);
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
    return Boolean(inventoryReportMessage);
  }, [inventoryReportMessage]);

  const cashStepComplete = useMemo(() => {
    return steps.some((step) => step.tool_key === "cash_count" && step.is_complete);
  }, [steps]);



  const featuredSteps = useMemo(() => {
    const inventoryStep = steps.find((step) => step.tool_key === "inventory_count") ?? null;
    const cashStep = steps.find((step) => step.tool_key === "cash_count") ?? null;

    return { inventoryStep, cashStep };
  }, [steps]);

  const hasInventoryStep = true;
  async function handleRunInventory() {
    try {
      setError(null);
      setSavingStepId("inventory_count");

      const res = await fetch(clientApiUrl("/api/counts"), {
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
      setError(fetchErrorToUserMessage(err));
    } finally {
      setSavingStepId(null);
    }
  }
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

  const isLastDayClosing = closingRun?.checklist_key === "last_day_closing";
  const combinedReportMessage = useMemo(() => {
    const parts: string[] = [];

    if (inventoryReportMessage) {
      parts.push(`${reportDateLabel}\n\n${inventoryReportMessage}`);
    }

    if (cashCountTotal != null) {
      const cashMessage = inventoryReportMessage
        ? `cash count: $${cashCountTotal.toFixed(2)}`
        : `${reportDateLabel} - cash count: $${cashCountTotal.toFixed(2)}`;
      parts.push(cashMessage);
    }

    return parts.join("\n\n");
  }, [inventoryReportMessage, cashCountTotal, reportDateLabel]);


  const canSendReport = useMemo(() => {
    if (!cashStepComplete) return false;
    return Boolean(combinedReportMessage);
  }, [cashStepComplete, combinedReportMessage]);

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
      
          const res = await fetch(clientApiUrl("/api/counts"), {
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
          setError(fetchErrorToUserMessage(err));
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

      const res = await fetch(clientApiUrl(`/api/closing/${id}`), {
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
      setError(fetchErrorToUserMessage(err));
    } finally {
      setSavingStepId(null);
    }
  }

  async function handleCopyReportMessage() {
    if (!combinedReportMessage) {
      setError("No report message available yet");
      return;
    }

    setCopyingReport(true);
    setError(null);

    let copied = false;
    try {
      await navigator.clipboard.writeText(combinedReportMessage);
      copied = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = combinedReportMessage;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      setError("Could not copy to clipboard. Try selecting the text manually.");
      setCopyingReport(false);
      return;
    }

    setReportCopiedJustNow(true);
    window.setTimeout(() => {
      setReportCopiedJustNow(false);
    }, 1500);

    try {
      let storedUser: { name?: string } | null = null;
      try {
        const raw = window.localStorage.getItem("rc_user");
        if (raw) storedUser = JSON.parse(raw) as { name?: string };
      } catch {
        storedUser = null;
      }

      const res = await fetch(clientApiUrl(`/api/closing/${id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_copied: true,
          report_copied_by_name: storedUser?.name ?? null,
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
        throw new Error(json.error || "Failed to update report status");
      }

      setReportCopied(true);
    } catch (err) {
      setReportCopied(true);
      setError(
        `${fetchErrorToUserMessage(err)} The report was still copied to your clipboard.`
      );
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

      const res = await fetch(clientApiUrl(`/api/closing/${id}`), {
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
      setError(fetchErrorToUserMessage(err));
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
    return `${inventorySavedCount}/${inventoryTotalCount}`;
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


  return (
    <main
      className="min-h-screen w-full space-y-6 px-6 pb-28 pt-4"
      style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
    >
      <ChecklistToolsHeader
        title="Closing"
        backHref="/"
        onRunInventory={() => void handleRunInventory()}
        onCountCash={
          featuredSteps.cashStep
            ? () => {
                void handleToggleStep(featuredSteps.cashStep!);
              }
            : undefined
        }
        onSendReport={() => void handleCopyReportMessage()}
        inventoryStatus={
          savingStepId === "inventory_count"
            ? "saving"
            : inventoryStepComplete
            ? "complete"
            : "pending"
        }
        cashStatus={
          featuredSteps.cashStep
            ? savingStepId === featuredSteps.cashStep.id
              ? "saving"
              : isStepVisuallyComplete(featuredSteps.cashStep)
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
        inventoryLabel={getInventoryProgressLabel()}
        cashLabel={getCashProgressLabel()}
        reportLabel={
          copyingReport
            ? "Copying..."
            : reportCopiedJustNow
            ? "Copied!"
            : reportCopied
            ? "Copied"
            : "Copy Message"
        }
        showInventory={true}
        showCash={Boolean(featuredSteps.cashStep)}
        showReport={canSendReport}
        inventoryDisabled={savingStepId === "inventory_count"}
        cashDisabled={featuredSteps.cashStep ? savingStepId === featuredSteps.cashStep.id : false}
        reportDisabled={copyingReport || !canSendReport}
      />

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}


      {loading ? (
        <div className="text-sm text-gray-600">Loading checklist...</div>
      ) : (
        <div className="space-y-6">

          <div className="space-y-3">
            <H2 className="mb-5 pt-3 text-[var(--color-primary,#004DEA)]">
              Closing Checklist
            </H2>

            {checklistSteps.map((step) => {
              if (!stepRefs.current[step.id]) {
                stepRefs.current[step.id] = createRef<HTMLDivElement>();
              }

              return (
                <div key={step.id} ref={stepRefs.current[step.id]} className="space-y-3">
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
                        : isStepVisuallyComplete(step)
                        ? "complete"
                        : "pending"
                    }
                    onClick={() => handleToggleStep(step)}
                    disabled={savingStepId === step.id}
                    activeScale
                  />
                </div>
              );
            })}
          </div>

        </div>
      )}
      {!loading && (
        <StickySubmitButton
          label={submitting ? "Submitting..." : "Submit Closing Checklist"}
          onClick={submitClosingChecklist}
          disabled={submitting || !allStepsComplete}
        />
      )}
    </main>
  );
}