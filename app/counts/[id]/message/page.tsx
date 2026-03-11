"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type CountLine = {
  id: string;
  inventory_item_id: string;
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
  supplier: string;
};

type CountRecord = {
  id: string;
  status: string;
  count_date: string;
};

type InventoryItem = {
  id: string;
  supplier?: string | null;
};

export default function CountMessagePage() {
  const params = useParams<{ id: string }>();
  const countId = params?.id;

  const [lines, setLines] = useState<CountLine[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [count, setCount] = useState<CountRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadMessageData() {
      if (!countId) return;

      try {
        setLoading(true);
        setError(null);

        const [countRes, itemsRes] = await Promise.all([
          fetch(`/api/counts/${countId}`),
          fetch(`/api/items`),
        ]);

        const countJson = await countRes.json();
        const itemsJson = await itemsRes.json();

        if (!countRes.ok) {
          throw new Error(countJson.error || "Failed to load message");
        }

        if (!itemsRes.ok) {
          throw new Error(itemsJson.error || "Failed to load inventory items");
        }

        setLines(countJson.lines ?? []);
        setCount(countJson.count ?? null);
        setInventoryItems(itemsJson.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadMessageData();
  }, [countId]);

  const supplierByItemId = useMemo(() => {
    return inventoryItems.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.supplier?.trim() || "Unassigned Supplier";
      return acc;
    }, {});
  }, [inventoryItems]);

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
          supplier: supplierByItemId[line.inventory_item_id] || "Unassigned Supplier",
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
  }, [lines, supplierByItemId]);


  const reorderMessage = useMemo(() => {
    const parts: string[] = ["rolling cones reorder report", ""];

    if (reportItems.length === 0) {
      parts.push("no items need reordering.");
      return parts.join("\n").trim();
    }

    const grouped = reportItems.reduce<Record<string, ReportItem[]>>((acc, item) => {
      const supplier = item.supplier || "Unassigned Supplier";
      if (!acc[supplier]) acc[supplier] = [];
      acc[supplier].push(item);
      return acc;
    }, {});

    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .forEach((supplier) => {
        parts.push(`${supplier}:`);

        grouped[supplier]
          .sort((a, b) => {
            if (a.item_category !== b.item_category) {
              return a.item_category.localeCompare(b.item_category);
            }
            return a.item_sort_order - b.item_sort_order;
          })
          .forEach((item) => {
            parts.push(`- ${item.item_name}: order ${item.suggestedOrderQty} ${item.item_unit}`);
          });

        parts.push("");
      });

    return parts.join("\n").trim();
  }, [reportItems]);

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(reorderMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Failed to copy message");
    }
  }

  const isSubmitted = count?.status === "submitted";

  return (
    <>
      <main className="mx-auto max-w-md p-6 space-y-6 pb-32">
        <div className="pt-4">
          <Link
            href={countId ? `/counts/${countId}/report` : "/"}
            className="text-sm text-gray-600 underline"
          >
            ← Back to Report
          </Link>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold">Send Report</h1>
          </div>
          <p className="text-sm text-gray-600">
            Copy and paste this message into a text to Alex and Nikki.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-600">Loading message...</p>
        ) : !isSubmitted ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
            This report has not been submitted yet.
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Reorder Message</h2>

            <textarea
              readOnly
              value={reorderMessage}
              className="min-h-[320px] w-full rounded border bg-gray-50 px-3 py-3 text-sm"
            />
          </div>
        )}
      </main>

      {isSubmitted && !loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
            <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium disabled:opacity-50"
                >
                  {copied ? "Copied" : "Copy Message"}
                </button>

                <Link
                  href="/"
                  className="block w-full rounded-xl border px-4 py-3 text-center font-medium text-gray-900"
                >
                  Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}