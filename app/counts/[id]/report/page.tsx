"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CountLine = {
  id: string;
  item_name: string;
  item_unit: string;
  item_category: string;
  item_threshold: number;
  item_par: number;
  item_sort_order: number;
  trailer_qty: number;
  storage_qty: number;
};

type ReportItem = CountLine & {
  total: number;
  status: "critical" | "low";
  suggestedOrderQty: number;
};

export default function CountReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

        const res = await fetch(`/api/counts/${countId}`);
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
  }, [countId]);

  const reportItems = useMemo<ReportItem[]>(() => {
    return lines
      .map((line) => {
        const total = line.trailer_qty + line.storage_qty;
        const status =
          total === 0
            ? "critical"
            : total <= line.item_threshold
            ? "low"
            : null;

        if (!status) return null;

        return {
          ...line,
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
      setCountStatus(nextStatus);
      router.push(`/counts/${countId}/message`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  const isSubmitted = countStatus === "submitted";

  return (
    <>
      <main className="mx-auto max-w-md p-6 space-y-6 pb-32">
        <div className="pt-4">
          <Link
            href={countId ? `/counts/${countId}` : "/"}
            className="text-sm text-gray-600 underline"
          >
            ← Back to Count
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Report</h1>
          <p className="text-sm text-gray-600">
            Review low and critical items before submitting.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-600">Loading report...</p>
        ) : reportItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
            No low or critical items found in this count.
          </div>
        ) : (
          <div className="space-y-6">
            {criticalItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-red-700">Critical</h2>
                {criticalItems.map((item) => (
                  <ReportCard key={item.id} item={item} />
                ))}
              </section>
            )}

            {lowItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-yellow-700">Low</h2>
                {lowItems.map((item) => (
                  <ReportCard key={item.id} item={item} />
                ))}
              </section>
            )}
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
          <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
            {!isSubmitted ? (
              <button
                onClick={handleSubmitReport}
                disabled={submitting || loading}
                className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            ) : (
              <button
                onClick={() => router.push(`/counts/${countId}/message`)}
                className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium"
              >
                View Reorder Message
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  return (
    <div className="rounded-lg border p-4 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{item.item_name}</div>
          <div className="text-sm text-gray-600">
            {item.item_category} · {item.item_unit}
          </div>
        </div>

        <div
          className={`rounded border px-2 py-1 text-xs font-medium ${
            item.status === "critical"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-yellow-200 bg-yellow-50 text-yellow-700"
          }`}
        >
          {item.status.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
        <div>Trailer: {item.trailer_qty}</div>
        <div>Storage: {item.storage_qty}</div>
      </div>
    </div>
  );
}