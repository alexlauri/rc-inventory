"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import LoadingSpinner from "@/app/components/LoadingSpinner";
import PageHeader from "@/app/components/PageHeader";
import ReportItemCard, {
  ReportItemsTableHead,
  type CountLine,
  type ReportItem,
  getSupplierLabel,
} from "@/app/components/ReportItemCard";
import StickySubmitButton from "@/app/components/StickySubmitButton";

function formatInventoryQty(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(value.toFixed(2)).replace(/\.?0+$/, "");
}

function buildInventoryReportMessage(items: ReportItem[]) {
  if (items.length === 0) {
    return "Rolling Cones Order Guide\n\nNo items need to be reordered.";
  }

  const groupedItems = items.reduce<Record<string, ReportItem[]>>((acc, item) => {
    const supplier = getSupplierLabel(item);

    if (!acc[supplier]) {
      acc[supplier] = [];
    }

    acc[supplier].push(item);
    return acc;
  }, {});

  const sections: string[] = ["Rolling Cones Order Guide"];

  Object.entries(groupedItems)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([supplier, supplierItems]) => {
      sections.push("", supplier);

      const criticalItems = supplierItems.filter((item) => item.status === "critical");
      const lowItems = supplierItems.filter((item) => item.status === "low");

      [...criticalItems, ...lowItems].forEach((item) => {
        sections.push(`- ${item.item_name} (${formatInventoryQty(item.total)} ${item.item_unit})`);
      });
    });

  return sections.join("\n");
}

export default function CountReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const closingRunId = searchParams.get("closing_run_id");
  const reportSync = searchParams.get("report_sync");
  const countId = params?.id;

  const [lines, setLines] = useState<CountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countStatus, setCountStatus] = useState<string>("draft");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadLines() {
      if (!countId) return;

      try {
        setLoading(true);
        setError(null);
        setLines([]);

        const res = await fetch(`/api/counts/${countId}?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load report");
        }

        setLines(json.lines ?? []);
        setCountStatus(json.count?.status ?? "draft");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadLines();
  }, [countId, reportSync]);

  const reportItems = useMemo<ReportItem[]>(() => {

    return lines
      .map((line) => {
        const trailer_qty = Number(line.trailer_qty ?? 0);
        const storage_qty = Number(line.storage_qty ?? 0);
        const total = trailer_qty + storage_qty;
        const status =
          total === 0
            ? "critical"
            : total <= line.item_threshold
            ? "low"
            : null;

        if (!status) return null;

        return {
          ...line,
          trailer_qty,
          storage_qty,
          total,
          status,
          suggestedOrderQty: Math.max(line.item_par - total, 0),
        };
      })
      .filter((item): item is ReportItem => item !== null)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "critical" ? -1 : 1;
        }

        if (a.item_category !== b.item_category) {
          return a.item_category.localeCompare(b.item_category);
        }

        return a.item_sort_order - b.item_sort_order;
      });
  }, [lines]);

  const criticalItems = reportItems.filter((item) => item.status === "critical");
  const lowItems = reportItems.filter((item) => item.status === "low");

  async function persistReportMessage() {
    const reportMessage = buildInventoryReportMessage(reportItems);

    // keep local fallback under both keys so the closing page can always find it
    if (typeof window !== "undefined") {
      const storageKeys = [closingRunId, countId].filter(
        (value): value is string => Boolean(value)
      );

      storageKeys.forEach((storageKeyBase) => {
        window.localStorage.setItem(
          `inventory_report_message_${storageKeyBase}`,
          reportMessage
        );
        window.localStorage.setItem(
          `inventory_report_copied_${storageKeyBase}`,
          "false"
        );
      });
    }

    // persist to closing run for shared multi-user state
    if (closingRunId) {
      const res = await fetch(`/api/closing/${closingRunId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inventory_report_message: reportMessage,
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
        throw new Error(json.error || "Failed to persist shared report message");
      }
    }
    return reportMessage;
  }

  async function ensureClosingRunHasReportMessage(expectedMessage: string) {
    if (!closingRunId) {
      return;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await fetch(`/api/closing/${closingRunId}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const text = await res.text();

      let json: {
        error?: string;
        run?: { inventory_report_message?: string | null } | null;
      } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to verify saved report");
      }

      if (json.run?.inventory_report_message === expectedMessage) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    throw new Error("Report saved locally, but closing run did not refresh in time");
  }

  async function completeInventoryStep() {
    if (!closingRunId || typeof window === "undefined") {
      return;
    }

    const storedUser = window.localStorage.getItem("rc_user");

    if (!storedUser) {
      return;
    }

    const user = JSON.parse(storedUser) as { id: string; name: string };

    const closingRes = await fetch(`/api/closing/${closingRunId}?t=${Date.now()}`, {
      cache: "no-store",
    });
    const closingText = await closingRes.text();
    let closingJson: {
      error?: string;
      steps?: Array<{ id: string; tool_key: string | null; is_complete: boolean }>;
    } = {};

    try {
      closingJson = closingText ? JSON.parse(closingText) : {};
    } catch {
      closingJson = {};
    }

    if (!closingRes.ok) {
      throw new Error(closingJson.error || "Failed to load closing checklist");
    }

    const inventoryStep = (closingJson.steps ?? []).find(
      (step) => step.tool_key === "inventory_count"
    );

    if (!inventoryStep) {
      return;
    }

    await fetch(`/api/closing/${closingRunId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        step_id: inventoryStep.id,
        is_complete: true,
        completed_by_user_id: user.id,
        completed_by_name: user.name,
      }),
    });
  }

  async function handleSubmitReport() {
    if (!countId) return;

    try {
      setSubmitting(true);
      setError(null);

      const storedUser = window.localStorage.getItem("rc_user");

      if (!storedUser) {
        setError("No logged in user found");
        return;
      }

      const user = JSON.parse(storedUser) as { id: string; name: string };

      const res = await fetch(`/api/counts/${countId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "submitted",
          submitted_by_user_id: user.id,
          submitted_by_name: user.name,
        }),
      });

      const text = await res.text();
      let json: { error?: string; details?: string; code?: string; hint?: string; count?: { status?: string } } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        const messageParts = [json.error || "Failed to submit report"];

        if (json.details) messageParts.push(json.details);
        if (json.hint) messageParts.push(`Hint: ${json.hint}`);
        if (json.code) messageParts.push(`Code: ${json.code}`);

        throw new Error(messageParts.join(" — "));
      }
      const nextStatus = json.count?.status ?? "submitted";

      await completeInventoryStep();
      const reportMessage = await persistReportMessage();
      await ensureClosingRunHasReportMessage(reportMessage);

      setCountStatus(nextStatus);

      if (closingRunId && typeof window !== "undefined") {
        window.sessionStorage.setItem(`inventory_report_scroll_${closingRunId}`, "true");
      }

      router.push(closingRunId ? `/closing/${closingRunId}` : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  const isSubmitted = countStatus === "submitted";

  const countBackHref =
    countId != null && countId !== ""
      ? `/counts/${countId}${
          closingRunId ? `?closing_run_id=${closingRunId}` : ""
        }`
      : "/";

  return (
    <>
      <main
        className="min-h-screen w-full space-y-4 px-6 pb-32 pt-4"
        style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
      >
        <PageHeader
          title="Report"
          backHref={countBackHref}
          className="text-[var(--color-primary,#004DEA)]"
          titleClassName="text-[var(--color-primary,#004DEA)]"
        />

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : reportItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
            No low or critical items found in this count.
          </div>
        ) : (
          <div className="space-y-6">
            {criticalItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-red-700">Critical</h2>
                <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
                  <table className="w-full min-w-[280px] border-collapse text-sm">
                    <ReportItemsTableHead />
                    <tbody>
                      {criticalItems.map((item) => (
                        <ReportItemCard key={item.id} item={item} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {lowItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-yellow-700">Low</h2>
                <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
                  <table className="w-full min-w-[280px] border-collapse text-sm">
                    <ReportItemsTableHead />
                    <tbody>
                      {lowItems.map((item) => (
                        <ReportItemCard key={item.id} item={item} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <StickySubmitButton
        disabled={submitting || loading}
        onClick={() => {
          if (!isSubmitted) {
            void handleSubmitReport();
            return;
          }

          void (async () => {
            try {
              setSubmitting(true);
              await completeInventoryStep();
              const reportMessage = await persistReportMessage();
              await ensureClosingRunHasReportMessage(reportMessage);

              if (closingRunId && typeof window !== "undefined") {
                window.sessionStorage.setItem(`inventory_report_scroll_${closingRunId}`, "true");
              }

              router.push(closingRunId ? `/closing/${closingRunId}` : "/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to save report");
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      >
        {submitting ? "Saving..." : "Save Report"}
      </StickySubmitButton>
    </>
  );
}