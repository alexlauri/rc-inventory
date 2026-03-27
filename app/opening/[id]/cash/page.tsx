"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/app/components/PageHeader";
import StickySubmitButton from "@/app/components/StickySubmitButton";
import CashCountForm from "@/app/components/CashCountForm";

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


  return (
    <main className="mx-auto max-w-md p-4 space-y-6 pb-28">
      <PageHeader title="Count Cash" backHref={`/opening/${openingId}`} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading || initializing ? (
        <div className="text-sm text-gray-500">Loading cash count…</div>
      ) : (
        <>
          <CashCountForm
            actualTotal={actualTotal}
            denominations={denominations}
            onUpdateDenomination={(row, nextValue) => {
              updateDenomination(row, nextValue);
            }}
          />

          <StickySubmitButton
            label={submitting ? "Saving..." : "Save Cash Count"}
            onClick={() => void submitCashCount()}
            disabled={submitting}
          />
        </>
      )}
    </main>
  );
}