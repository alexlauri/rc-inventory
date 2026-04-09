"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/app/components/PageHeader";
import StickySubmitButton from "@/app/components/StickySubmitButton";
import CashCountForm from "@/app/components/CashCountForm";

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
  const lastLocalEditAtRef = useRef(0);
  const isHydratingRef = useRef(false);

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

        isHydratingRef.current = true;
        setCashCount(json.cashCount ?? null);
        setDenominations(json.denominations ?? []);
        isHydratingRef.current = false;
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

  useEffect(() => {
    let cancelled = false;

    async function refreshCashCountInBackground() {
      if (cancelled || loading || submitting) {
        return;
      }

      if (Date.now() - lastLocalEditAtRef.current < 1200) {
        return;
      }

      try {
        const res = await fetch(`/api/closing/${id}/cash`, {
          cache: "no-store",
        });
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

        if (!res.ok || !json.cashCount) {
          return;
        }

        if (cancelled) {
          return;
        }

        isHydratingRef.current = true;
        setCashCount(json.cashCount ?? null);
        setDenominations(json.denominations ?? []);
        isHydratingRef.current = false;
      } catch {
        // Ignore background refresh failures to avoid disrupting active counting.
      }
    }

    const interval = window.setInterval(() => {
      void refreshCashCountInBackground();
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCashCountInBackground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [id, loading, submitting]);

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
    if (!isHydratingRef.current) {
      lastLocalEditAtRef.current = Date.now();
    }

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
    <main
      className="min-h-screen w-full space-y-6 px-6 pb-28 pt-4"
      style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
    >
      <div className="space-y-3">
        <PageHeader
          title="Count Cash"
          backHref={`/closing/${id}`}
          className="text-[var(--color-primary,#004DEA)]"
          titleClassName="text-[var(--color-primary,#004DEA)]"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading cash count...</div>
      ) : (
        <CashCountForm
          actualTotal={Number(cashCount?.actual_total ?? 0)}
          denominations={denominations}
          onUpdateDenomination={(row, nextValue) => {
            if (row.denomination === "coins") {
              const nextAmount = Math.max(0, Number(nextValue ?? 0));
              applyLocalDenominationUpdate(row.id, null, nextAmount);
              queueDenominationSave(row.id, null, nextAmount);
              return;
            }

            const nextQuantity = Math.max(0, Number(nextValue ?? 0));
            const nextAmount = nextQuantity * row.unit_value;
            applyLocalDenominationUpdate(row.id, nextQuantity, nextAmount);
            queueDenominationSave(row.id, nextQuantity, nextAmount);
          }}
        />
      )}
      {!loading && (
        <StickySubmitButton
          label={submitting ? "Saving..." : "Save Cash Count"}
          onClick={submitCashCount}
          disabled={submitting}
        />
      )}
    </main>
  );
}