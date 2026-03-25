"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CashCount = {
  id: string;
  status: string;
  actual_total: number;
  expected_total?: number | null;
  variance?: number | null;
  counted_by_name?: string | null;
};

type DenominationRow = {
  id: string;
  denomination: string;
  unit_value: number;
  quantity: number | null;
  amount: number;
  sort_order: number;
};

type CashResponse = {
  cashCount: CashCount | null;
  denominations: DenominationRow[];
  error?: string;
};

export default function OpeningCashPage() {
  const params = useParams();
  const router = useRouter();
  const openingId = params.id as string;

  const [cashCount, setCashCount] = useState<CashCount | null>(null);
  const [denominations, setDenominations] = useState<DenominationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadCashCount();
  }, [openingId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  async function loadCashCount() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/opening/${openingId}/cash`);
      const text = await res.text();
      let json: CashResponse = { cashCount: null, denominations: [] };

      try {
        json = text ? JSON.parse(text) : { cashCount: null, denominations: [] };
      } catch {
        json = { cashCount: null, denominations: [] };
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to load cash count");
      }

      if (!json.cashCount) {
        await initializeCashCount();
        return;
      }

      setCashCount(json.cashCount);
      setDenominations(json.denominations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cash count");
    } finally {
      setLoading(false);
    }
  }

  async function initializeCashCount() {
    try {
      setInitializing(true);
      setError(null);

      const res = await fetch(`/api/opening/${openingId}/cash`, {
        method: "POST",
      });
      const text = await res.text();
      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to initialize cash count");
      }

      await loadCashCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize cash count");
    } finally {
      setInitializing(false);
    }
  }

  const actualTotal = useMemo(() => {
    return denominations.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  }, [denominations]);

  async function persistDenominationUpdate(
    rowId: string,
    quantity: number | null,
    amount: number
  ) {
    try {
      const res = await fetch(`/api/opening/${openingId}/cash`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          denomination_id: rowId,
          quantity,
          amount,
        }),
      });

      const text = await res.text();
      let json: {
        error?: string;
        denomination?: DenominationRow;
        cashCount?: CashCount;
      } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to update denomination");
      }

      // Intentionally do not overwrite local optimistic state here.
      // Rapid taps can cause out-of-order responses; the UI should keep
      // the latest local value and let the server catch up in the background.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update denomination");
    }
  }

  async function flushPendingDenominationSave() {
    if (!saveTimeoutRef.current) {
      return;
    }

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;

    await Promise.all(
      denominations.map((row) =>
        persistDenominationUpdate(
          row.id,
          row.denomination === "coins" ? null : row.quantity ?? 0,
          Number(row.amount ?? 0)
        )
      )
    );
  }

  function updateDenomination(row: DenominationRow, nextValue: number | null) {
    setError(null);
    const isCoins = row.denomination === "coins";
    const quantity = isCoins ? null : Math.max(0, nextValue ?? 0);
    const amount = isCoins
      ? Math.max(0, nextValue ?? 0)
      : Math.max(0, quantity ?? 0) * Number(row.unit_value ?? 0);

    setDenominations((prev) =>
      prev.map((item) => {
        if (item.id !== row.id) {
          return item;
        }

        const currentIsCoins = item.denomination === "coins";
        const nextQuantity = currentIsCoins ? null : Math.max(0, nextValue ?? 0);
        const nextAmount = currentIsCoins
          ? Math.max(0, nextValue ?? 0)
          : Math.max(0, nextQuantity ?? 0) * Number(item.unit_value ?? 0);

        return {
          ...item,
          quantity: nextQuantity,
          amount: nextAmount,
        };
      })
    );

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void persistDenominationUpdate(row.id, quantity, amount);
    }, 250);
  }

  async function submitCashCount() {
    try {
      setSubmitting(true);
      setError(null);

      const storedUserRaw =
        typeof window !== "undefined" ? window.localStorage.getItem("rc_user") : null;
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

      await flushPendingDenominationSave();

      const res = await fetch(`/api/opening/${openingId}/cash`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          counted_by_user_id: storedUser?.id ?? null,
          counted_by_name: storedUser?.name ?? null,
        }),
      });

      const text = await res.text();
      let json: { error?: string; cashCount?: CashCount } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to submit cash count");
      }

      if (json.cashCount) {
        setCashCount(json.cashCount);
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(`opening_cash_scroll_${openingId}`, "true");
      }

      window.location.href = `/opening/${openingId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit cash count");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || initializing) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500">Loading cash count…</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-32 space-y-4">
      <button
        type="button"
        onClick={() => router.push(`/opening/${openingId}`)}
        className="text-sm text-gray-500"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-semibold">Count cash</h1>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm text-gray-500">Actual Total</div>
        <div className="mt-1 text-3xl font-semibold">${actualTotal.toFixed(2)}</div>
      </div>

      <div className="space-y-3">
        {denominations.map((row) => {
          const isCoins = row.denomination === "coins";
          const quantityValue = row.quantity ?? 0;
          const amountValue = Number(row.amount ?? 0);

          return (
            <div key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{row.denomination}</div>
                  <div className="text-sm text-gray-500">
                    {isCoins ? "Enter dollar value" : `${Number(row.unit_value).toFixed(2)} each`}
                  </div>
                </div>

                {isCoins ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amountValue}
                    onChange={(event) => {
                      const next = Number(event.target.value || 0);
                      void updateDenomination(row, next);
                    }}
                    className="w-28 rounded-lg border px-3 py-2 text-right"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void updateDenomination(row, quantityValue - 1)}
                      className="h-9 w-9 rounded-lg border"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={quantityValue}
                      onChange={(event) => {
                        const next = Number(event.target.value || 0);
                        void updateDenomination(row, next);
                      }}
                      className="w-16 rounded-lg border px-2 py-2 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => void updateDenomination(row, quantityValue + 1)}
                      className="h-9 w-9 rounded-lg border"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
        <button
          type="button"
          onClick={() => void submitCashCount()}
          disabled={submitting}
          className="w-full rounded-xl bg-black py-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save cash count"}
        </button>
      </div>
    </div>
  );
}