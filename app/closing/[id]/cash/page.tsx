"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type CashDenomination = {
  id: string;
  denomination: string;
  unit_value: number;
  quantity: number | null;
  amount: number;
  sort_order: number;
};

type CashCount = {
  id: string;
  status: string;
  actual_total: number;
  expected_total: number | null;
  variance: number | null;
};

export default function ClosingCashPage() {
  const params = useParams();
  const id = params.id as string;

  const [cashCount, setCashCount] = useState<CashCount | null>(null);
  const [denominations, setDenominations] = useState<CashDenomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    async function initializeAndLoadCashCount() {
      try {
        setLoading(true);
        setError(null);

        const initRes = await fetch(`/api/closing/${id}/cash`, {
          method: "POST",
        });

        const initText = await initRes.text();
        let initJson: { error?: string } = {};

        try {
          initJson = initText ? JSON.parse(initText) : {};
        } catch {
          initJson = {};
        }

        if (!initRes.ok) {
          throw new Error(initJson.error || "Failed to initialize cash count");
        }

        const res = await fetch(`/api/closing/${id}/cash`);
        const text = await res.text();

        let json: {
          error?: string;
          cashCount?: CashCount | null;
          denominations?: CashDenomination[];
        } = {};

        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load cash count");
        }

        setCashCount(json.cashCount ?? null);
        setDenominations(json.denominations ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cash count");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      initializeAndLoadCashCount();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      Object.values(saveTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  async function persistDenominationUpdate(
    rowId: string,
    nextQuantity: number | null,
    nextAmount: number
  ) {
    try {
      setError(null);

      const res = await fetch(`/api/closing/${id}/cash`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          denomination_id: rowId,
          quantity: nextQuantity,
          amount: nextAmount,
        }),
      });

      const text = await res.text();
      let json: {
        error?: string;
        denomination?: CashDenomination;
        cashCount?: CashCount;
      } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.cashCount) {
        throw new Error(json.error || "Failed to update cash count");
      }

      setCashCount(json.cashCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update cash count");
    }
  }

  function applyLocalDenominationUpdate(
    rowId: string,
    nextQuantity: number | null,
    nextAmount: number
  ) {
    setDenominations((prev) =>
      prev.map((currentRow) =>
        currentRow.id === rowId
          ? {
              ...currentRow,
              quantity: nextQuantity,
              amount: nextAmount,
            }
          : currentRow
      )
    );

    setCashCount((prev) => {
      if (!prev) return prev;

      const nextActualTotal = denominations.reduce((sum, currentRow) => {
        if (currentRow.id === rowId) {
          return sum + nextAmount;
        }
        return sum + Number(currentRow.amount ?? 0);
      }, 0);

      return {
        ...prev,
        actual_total: nextActualTotal,
      };
    });
  }

  function queueDenominationSave(
    rowId: string,
    nextQuantity: number | null,
    nextAmount: number
  ) {
    const existingTimeout = saveTimeoutsRef.current[rowId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    saveTimeoutsRef.current[rowId] = setTimeout(() => {
      void persistDenominationUpdate(rowId, nextQuantity, nextAmount);
    }, 1200);
  }

  async function flushPendingDenominationSaves() {
    const pendingRowIds = Object.keys(saveTimeoutsRef.current);

    if (!pendingRowIds.length) {
      return;
    }

    pendingRowIds.forEach((rowId) => {
      const timeoutId = saveTimeoutsRef.current[rowId];
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });

    saveTimeoutsRef.current = {};

    const rowsToFlush = denominations.filter((row) => pendingRowIds.includes(row.id));

    await Promise.all(
      rowsToFlush.map((row) =>
        persistDenominationUpdate(
          row.id,
          row.denomination === "coins" ? null : row.quantity ?? 0,
          Number(row.amount ?? 0)
        )
      )
    );
  }

  function parseQuantityInput(value: string) {
    if (value.trim() === "") return 0;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, parsed);
  }

  async function submitCashCount() {
    try {
      setSubmitting(true);
      setError(null);

      const storedUser = typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("rc_user") || "null")
        : null;

      if (!storedUser?.id || !storedUser?.name) {
        throw new Error("No logged in user found");
      }

      await flushPendingDenominationSaves();

      const res = await fetch(`/api/closing/${id}/cash`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          counted_by_user_id: storedUser?.id,
          counted_by_name: storedUser?.name,
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
        throw new Error(json.error || "Failed to submit cash count");
      }

      const cashStepForScroll = denominations.length ? "cash_count" : null;

      if (typeof window !== "undefined" && cashStepForScroll) {
        window.sessionStorage.setItem(`closing_cash_scroll_${id}`, "true");
      }

      window.location.href = `/closing/${id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit cash count");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-4 space-y-6 pb-28">
      <div className="space-y-1">
        <Link
          href={`/closing/${id}`}
          className="text-sm text-gray-600 underline"
        >
          ← Back to Closing
        </Link>
        <h1 className="text-2xl font-semibold">Count Cash</h1>
        <p className="text-sm text-gray-500">
          Count each denomination to close out the drawer.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading cash count...</div>
      ) : (
        <>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm text-gray-500">Actual Total</div>
            <div className="mt-1 text-2xl font-semibold">
              ${Number(cashCount?.actual_total ?? 0).toFixed(2)}
            </div>
          </div>

          <div className="space-y-3">
            {denominations.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border bg-white p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{row.denomination}</div>
                    <div className="text-sm text-gray-500">
                      {row.denomination === "coins"
                        ? "Enter total coin amount"
                        : `$${row.unit_value.toFixed(2)} each`}
                    </div>
                  </div>

                  {row.denomination === "coins" ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={Number(row.amount ?? 0)}
                      onChange={(e) => {
                        const nextAmount = Math.max(0, Number(e.target.value) || 0);
                        applyLocalDenominationUpdate(row.id, null, nextAmount);
                        queueDenominationSave(row.id, null, nextAmount);
                      }}
                      className="w-24 rounded border px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const currentQuantity = row.quantity ?? 0;
                          const nextQuantity = Math.max(0, currentQuantity - 1);
                          const nextAmount = nextQuantity * row.unit_value;
                          applyLocalDenominationUpdate(row.id, nextQuantity, nextAmount);
                          queueDenominationSave(row.id, nextQuantity, nextAmount);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border text-lg"
                      >
                        −
                      </button>

                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={row.quantity ?? 0}
                        onChange={(e) => {
                          const nextQuantity = parseQuantityInput(e.target.value);
                          const nextAmount = nextQuantity * row.unit_value;
                          applyLocalDenominationUpdate(row.id, nextQuantity, nextAmount);
                          queueDenominationSave(row.id, nextQuantity, nextAmount);
                        }}
                        className="w-16 rounded border px-2 py-1 text-center text-sm"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const currentQuantity = row.quantity ?? 0;
                          const nextQuantity = currentQuantity + 1;
                          const nextAmount = nextQuantity * row.unit_value;
                          applyLocalDenominationUpdate(row.id, nextQuantity, nextAmount);
                          queueDenominationSave(row.id, nextQuantity, nextAmount);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border text-lg"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {!loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
            <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
              <button
                type="button"
                onClick={submitCashCount}
                disabled={submitting}
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Cash Count"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}