"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

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

export default function CountDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const closingRunId = searchParams.get("closing_run_id");
  const countId = params?.id;

  const [lines, setLines] = useState<CountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLines() {
      if (!countId) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/counts/${countId}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load count");
        }

        setLines(json.lines ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadLines();
  }, [countId]);

  const groupedLines = useMemo(() => {
    const grouped: Record<string, CountLine[]> = {};

    for (const line of lines) {
      if (!grouped[line.item_category]) grouped[line.item_category] = [];
      grouped[line.item_category].push(line);
    }

    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => a.item_sort_order - b.item_sort_order);
    }

    return grouped;
  }, [lines]);

  async function updateLine(
    lineId: string,
    trailer_qty: number,
    storage_qty: number
  ) {
    if (!countId) return;

    try {
      setError(null);

      const res = await fetch(`/api/counts/${countId}/lines/${lineId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trailer_qty,
          storage_qty,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save line");
      }

      setLines((prev) =>
        prev.map((line) =>
          line.id === lineId ? { ...line, trailer_qty, storage_qty } : line
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save line");
    }
  }

  return (
    <>
      <main className="mx-auto max-w-md p-6 space-y-6 pb-32">
      <div className="pt-4">
        <Link
          href={closingRunId ? `/closing/${closingRunId}` : "/"}
          className="text-sm text-gray-600 underline"
        >
          ← Back
        </Link>
      </div>
  
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Weekly Count</h1>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading items...</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLines).map(([category, categoryLines]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-lg font-semibold">{category}</h2>

              {categoryLines.map((line) => (
                <InventoryLineCard
                  key={line.id}
                  line={line}
                  onSave={updateLine}
                />
              ))}
            </section>
          ))}
        </div>
      )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
          <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <Link
              href={
                countId
                  ? `/counts/${countId}/report${
                      closingRunId ? `?closing_run_id=${closingRunId}` : ""
                    }`
                  : "#"
              }
              className="block w-full rounded-xl bg-black px-4 py-3 text-center font-medium text-white shadow-sm transition active:scale-[0.99]"
            >
              Continue
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function InventoryLineCard({
  line,
  onSave,
}: {
  line: CountLine;
  onSave: (
    lineId: string,
    trailer_qty: number,
    storage_qty: number
  ) => Promise<void>;
}) {
  const [trailer, setTrailer] = useState<number>(line.trailer_qty);
  const [storage, setStorage] = useState<number>(line.storage_qty);

  useEffect(() => {
    setTrailer(line.trailer_qty);
    setStorage(line.storage_qty);
  }, [line.trailer_qty, line.storage_qty]);

  useEffect(() => {
    if (trailer === line.trailer_qty && storage === line.storage_qty) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void onSave(line.id, trailer, storage);
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [trailer, storage, line.id, line.trailer_qty, line.storage_qty, onSave]);

  const total = trailer + storage;
  const status =
    total === 0 ? "critical" : total <= line.item_threshold ? "low" : "ok";

  const statusClasses =
    status === "critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "low"
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{line.item_name}</div>
          <div className="text-sm text-gray-600">
            {line.item_unit} · par {line.item_par}
          </div>
        </div>

        <div className={`rounded border px-2 py-1 text-xs font-medium ${statusClasses}`}>
          {status.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CounterField
          label="Trailer"
          value={trailer}
          onChange={setTrailer}
        />
        <CounterField
          label="Storage"
          value={storage}
          onChange={setStorage}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">Total: {total}</div>
      </div>
    </div>
  );
}

function CounterField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  function decrement() {
    onChange(Math.max(0, value - 1));
  }

  function increment() {
    onChange(value + 1);
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          className="h-10 w-10 rounded border text-lg"
        >
          -
        </button>

        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value === "" ? 0 : Number(e.target.value);
            onChange(Math.max(0, Number.isFinite(nextValue) ? nextValue : 0));
          }}
          className="h-10 w-full rounded border px-3 text-center"
        />

        <button
          type="button"
          onClick={increment}
          className="h-10 w-10 rounded border text-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}