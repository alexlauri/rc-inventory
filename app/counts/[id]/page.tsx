"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import PageHeader from "@/app/components/PageHeader";
import StickySubmitButton from "@/app/components/StickySubmitButton";
import InventoryItemCard from "@/app/components/InventoryItemCard";
import { H2, Subtle } from "@/app/components/Type";

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
  updated_at?: string | null;
  created_at?: string | null;
  is_saved?: boolean | null;
  isSaved?: boolean | null;
};

export default function CountDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const closingRunId = searchParams.get("closing_run_id");
  const countId = params?.id;

  const [lines, setLines] = useState<CountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedLineIds, setCollapsedLineIds] = useState<Record<string, boolean>>({});
  const lastLocalEditAtRef = useRef(0);
  const hasHydratedLocalProgressRef = useRef(false);
  const lastFetchedServerLinesRef = useRef<Record<string, string | null>>({});
  const linesRef = useRef<CountLine[]>([]);
  const storageKey = countId ? `weekly-count-progress:${countId}` : null;
  const collapsedStorageKey = countId ? `weekly-count-collapsed:${countId}` : null;
  const [continueBusy, setContinueBusy] = useState(false);

  async function fetchLinesInBackground() {
    if (!countId) return;

    const res = await fetch(`/api/counts/${countId}?t=${Date.now()}`, {
      cache: "no-store",
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Failed to load count");
    }

    const nextLines: CountLine[] = json.lines ?? [];

    const changedIds = nextLines
      .filter((nextLine) => {
        const previousUpdatedAt = lastFetchedServerLinesRef.current[nextLine.id];
        return (
          previousUpdatedAt &&
          nextLine.updated_at &&
          previousUpdatedAt !== nextLine.updated_at
        );
      })
      .map((line) => line.id);

    if (changedIds.length > 0) {
      setCollapsedLineIds((current) => {
        const next = { ...current };
        changedIds.forEach((id) => {
          next[id] = true;
        });

        if (collapsedStorageKey) {
          try {
            localStorage.setItem(collapsedStorageKey, JSON.stringify(next));
          } catch {}
        }

        return next;
      });
    }

    lastFetchedServerLinesRef.current = Object.fromEntries(
      nextLines.map((line) => [line.id, line.updated_at ?? null])
    );

    let hydratedLines = nextLines;

    const serverCollapsedMap = Object.fromEntries(
      nextLines
        .filter((line) => {
          const explicitSaved = Boolean(line.is_saved ?? line.isSaved);
          const createdAt = line.created_at ?? null;
          const updatedAt = line.updated_at ?? null;
          const timestampSaved = Boolean(createdAt && updatedAt && createdAt !== updatedAt);
          return explicitSaved || timestampSaved;
        })
        .map((line) => [line.id, true])
    ) as Record<string, boolean>;

    // hydrate local draft only once on initial load, not on every live-sync poll
    if (storageKey && !hasHydratedLocalProgressRef.current) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Record<
            string,
            { trailer_qty: number; storage_qty: number }
          >;

          hydratedLines = nextLines.map((line) => {
            const local = saved[line.id];
            if (!local) return line;
            return {
              ...line,
              trailer_qty: local.trailer_qty,
              storage_qty: local.storage_qty,
            };
          });
        }
      } catch {}

      hasHydratedLocalProgressRef.current = true;
    }

    if (collapsedStorageKey) {
      try {
        const rawCollapsed = localStorage.getItem(collapsedStorageKey);
        if (rawCollapsed) {
          const savedCollapsed = JSON.parse(rawCollapsed) as Record<string, boolean>;
          setCollapsedLineIds({
            ...serverCollapsedMap,
            ...savedCollapsed,
          });
        } else {
          setCollapsedLineIds(serverCollapsedMap);
        }
      } catch {
        setCollapsedLineIds(serverCollapsedMap);
      }
    } else {
      setCollapsedLineIds(serverCollapsedMap);
    }

    setLines(hydratedLines);

    setError(null);
  }

  useEffect(() => {
    async function loadLines() {
      if (!countId) return;

      try {
        setLoading(true);
        setError(null);

        await fetchLinesInBackground();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadLines();
  }, [countId]);

  useEffect(() => {
    if (!countId || loading) return;
    router.prefetch(`/counts/${countId}/report`);
  }, [countId, loading, router]);

  useEffect(() => {
    if (!countId) return;

    let cancelled = false;

    async function refreshInBackground() {
      if (cancelled || loading) {
        return;
      }

      if (Date.now() - lastLocalEditAtRef.current < 3500) {
        return;
      }

      try {
        await fetchLinesInBackground();
      } catch {
        // Ignore background refresh failures to avoid disrupting active counting.
      }
    }

    const interval = window.setInterval(() => {
      void refreshInBackground();
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshInBackground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [countId, loading]);

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

  linesRef.current = lines;

  async function updateLine(
    lineId: string,
    trailer_qty: number,
    storage_qty: number
  ) {
    if (!countId) return;

    try {
      setError(null);
      lastLocalEditAtRef.current = Date.now();

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

      // persist local progress
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          const current = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              ...current,
              [lineId]: { trailer_qty, storage_qty },
            })
          );
        } catch {}
      }

      setCollapsedLineIds((prev) => {
        const next = {
          ...prev,
          [lineId]: true,
        };

        if (collapsedStorageKey) {
          try {
            localStorage.setItem(collapsedStorageKey, JSON.stringify(next));
          } catch {}
        }

        return next;
      });
      hasHydratedLocalProgressRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save line");
    }
  }

  /** Persists picker edits so background poll cannot wipe them before Continue flushes to the API. */
  const recordUnsavedLineQuantities = useCallback(
    (lineId: string, trailer_qty: number, storage_qty: number) => {
      lastLocalEditAtRef.current = Date.now();
      if (!storageKey) return;
      try {
        const raw = localStorage.getItem(storageKey);
        const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...current,
            [lineId]: { trailer_qty, storage_qty },
          })
        );
      } catch {
        // ignore quota / privacy errors
      }
    },
    [storageKey]
  );

  function readProgressDraft(): Record<
    string,
    { trailer_qty: number; storage_qty: number }
  > {
    if (!storageKey) return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      return JSON.parse(raw) as Record<
        string,
        { trailer_qty: number; storage_qty: number }
      >;
    } catch {
      return {};
    }
  }

  async function flushAllLinesToServer(): Promise<void> {
    if (!countId) return;

    const snapshot = linesRef.current;
    const draft = readProgressDraft();

    const updates = snapshot
      .filter((line) => line.id != null && line.id !== "")
      .map((line) => {
        const persisted = draft[line.id];
        const trailer_qty = Number(
          persisted?.trailer_qty ?? line.trailer_qty ?? 0
        );
        const storage_qty = Number(
          persisted?.storage_qty ?? line.storage_qty ?? 0
        );
        return { lineId: line.id, trailer_qty, storage_qty };
      });

    if (updates.length === 0) return;

    const res = await fetch(`/api/counts/${countId}/lines/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ updates }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || "Failed to save counts");
    }
  }

  return (
    <>
      <main
        className="min-h-screen w-full space-y-4 px-6 pb-32 pt-4"
        style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
      >
        <PageHeader
          title="Weekly Count"
          backHref={closingRunId ? `/closing/${closingRunId}` : "/"}
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
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedLines).map(([category, categoryLines]) => (
            <section key={category} className="space-y-6">
              <H2 className="text-[var(--color-primary,#004DEA)]">
                {category}
              </H2>

              {categoryLines.map((line) => (
                <InventoryLineCard
                  key={line.id}
                  line={line}
                  onSave={updateLine}
                  onUserQuantityChange={recordUnsavedLineQuantities}
                  collapsed={!!collapsedLineIds[line.id]}
                  onExpand={() => {
                    setCollapsedLineIds((prev) => {
                      const next = {
                        ...prev,
                        [line.id]: false,
                      };

                      if (collapsedStorageKey) {
                        try {
                          localStorage.setItem(collapsedStorageKey, JSON.stringify(next));
                        } catch {}
                      }

                      return next;
                    });
                  }}
                />
              ))}
            </section>
          ))}
        </div>
      )}
      </main>

      <StickySubmitButton
        disabled={!countId || continueBusy || loading}
        onClick={() => {
          void (async () => {
            if (!countId) return;

            try {
              setContinueBusy(true);
              setError(null);
              await flushAllLinesToServer();

              if (storageKey) {
                try {
                  localStorage.removeItem(storageKey);
                } catch {}
              }

              if (collapsedStorageKey) {
                try {
                  localStorage.removeItem(collapsedStorageKey);
                } catch {}
              }

              const reportQs = new URLSearchParams();
              reportQs.set("report_sync", String(Date.now()));
              if (closingRunId) {
                reportQs.set("closing_run_id", closingRunId);
              }

              router.push(
                `/counts/${countId}/report?${reportQs.toString()}`
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to save counts before report"
              );
            } finally {
              setContinueBusy(false);
            }
          })();
        }}
      >
        {continueBusy ? "Saving…" : "Continue"}
      </StickySubmitButton>
    </>
  );
}

function InventoryLineCard({
  line,
  onSave,
  onUserQuantityChange,
  collapsed,
  onExpand,
}: {
  line: CountLine;
  onSave: (
    lineId: string,
    trailer_qty: number,
    storage_qty: number
  ) => Promise<void>;
  /** Called when the user changes trailer/storage pickers (not on server-driven sync). */
  onUserQuantityChange?: (
    lineId: string,
    trailer_qty: number,
    storage_qty: number
  ) => void;
  collapsed: boolean;
  onExpand: () => void;
}) {
  const [trailer, setTrailer] = useState<number>(line.trailer_qty);
  const [storage, setStorage] = useState<number>(line.storage_qty);
  const [saving, setSaving] = useState(false);
  const total = trailer + storage;

  useEffect(() => {
    setTrailer(line.trailer_qty);
    setStorage(line.storage_qty);
  }, [line.trailer_qty, line.storage_qty]);

  function handleTrailerChange(next: number) {
    setTrailer(next);
    onUserQuantityChange?.(line.id, next, storage);
  }

  function handleStorageChange(next: number) {
    setStorage(next);
    onUserQuantityChange?.(line.id, trailer, next);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center justify-between gap-6 py-2 text-left transition active:scale-[0.99]"
        aria-label={`Edit ${line.item_name}`}
      >
        <div className="min-w-0 space-y-1">
          <H2>{line.item_name}</H2>
          <Subtle className="text-[var(--color-foreground,#3A3A3A)] uppercase tracking-[0.06em]">
            {(line.item_unit?.toUpperCase() || "UNIT") + " • PAR " + line.item_par}
          </Subtle>
        </div>

        <div className="shrink-0 rounded-full bg-[rgba(0,134,67,0.15)] px-4 py-2 pr-2">
          <div className="flex items-center gap-2.5">
            <div className="text-[17px] font-[700] leading-none text-[#008643] [font-family:var(--font-cabinet)] tabular-nums translate-y-0.25">
              {total}
            </div>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="12" />
              <path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2ZM16.2 10.3L11.4 15.1C11 15.5 10.4 15.5 10 15.1L7.8 12.9C7.4 12.5 7.4 11.9 7.8 11.5C8.2 11.1 8.8 11.1 9.2 11.5L10.7 13L14.8 8.9C15.2 8.5 15.8 8.5 16.2 8.9C16.6 9.3 16.6 9.9 16.2 10.3Z" fill="#008643"/>
            </svg>
          </div>
        </div>
      </button>
    );
  }

  return (
    <InventoryItemCard
      item={{
        id: line.id,
        item_name: line.item_name,
        item_category: line.item_category,
        item_unit: line.item_unit,
        item_par: line.item_par,
        item_threshold: line.item_threshold,
        trailer_qty: trailer,
        storage_qty: storage,
      }}
      onTrailerChange={handleTrailerChange}
      onStorageChange={handleStorageChange}
      onSave={() => {
        void (async () => {
          try {
            setSaving(true);
            await onSave(line.id, trailer, storage);
          } finally {
            setSaving(false);
          }
        })();
      }}
      saveLabel="Save"
      saveDisabled={saving}
    />
  );
}
