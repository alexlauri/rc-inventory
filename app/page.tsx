"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InventoryCount = {
  id: string;
  count_date: string;
  counted_by: string | null;
  notes: string | null;
  trailer_complete: boolean;
  storage_complete: boolean;
  status: string;
  submitted_by_name: string | null;
  created_at: string;
};

function formatCountDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getCountStatusMeta(count: InventoryCount) {
  const isComplete = count.trailer_complete && count.storage_complete;

  if (count.status === "submitted") {
    return {
      label: "Submitted",
      classes: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (isComplete) {
    return {
      label: "Ready",
      classes: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "Draft",
    classes: "border-yellow-200 bg-yellow-50 text-yellow-700",
  };
}

export default function HomePage() {
  const router = useRouter();
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<InventoryCount | null>(null);
  const [deletingCountId, setDeletingCountId] = useState<string | null>(null);

  async function loadCounts() {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/counts");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load counts");
      }

      setCounts(json.counts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCount() {
    try {
      setError(null);
      setCreating(true);

      const res = await fetch("/api/counts", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create count");
      }

      router.push(`/counts/${json.count.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create count");
    } finally {
      setCreating(false);
    }
  }

  function openDeleteDraftSheet(count: InventoryCount) {
    setDraftToDelete(count);
  }

  function closeDeleteDraftSheet() {
    if (deletingCountId) return;
    setDraftToDelete(null);
  }

  async function confirmDeleteDraft() {
    if (!draftToDelete) return;

    try {
      setError(null);
      setDeletingCountId(draftToDelete.id);

      const res = await fetch(`/api/counts/${draftToDelete.id}`, {
        method: "DELETE",
      });

      const text = await res.text();
      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete count");
      }

      setCounts((prev) => prev.filter((count) => count.id !== draftToDelete.id));
      setDraftToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete count");
    } finally {
      setDeletingCountId(null);
    }
  }

  useEffect(() => {
    loadCounts();
  }, []);

  return (
    <>
      <main className="mx-auto max-w-md p-4 space-y-6 pb-32">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Weekly Stock Check</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading counts...</div>
      ) : counts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm leading-6 text-gray-600">
          No counts yet. Tap "Start New Weekly Count" to begin your first inventory check.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Previous Counts
          </div>
          {counts.map((count) => {
            const status = getCountStatusMeta(count);
            const isDraft = count.status === "draft";

            return (
              <div
                key={count.id}
                className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/counts/${count.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/counts/${count.id}`);
                    }
                  }}
                  className="block cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{formatCountDate(count.count_date)}</div>
                      {count.submitted_by_name && (
                        <div className="text-sm text-gray-600">
                          Submitted by {count.submitted_by_name}
                        </div>
                      )}
                    </div>

                    <div className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.classes}`}>
                      {status.label}
                    </div>
                  </div>

                </div>

                {isDraft && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDraftSheet(count);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete Draft
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
          <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <button
              onClick={handleCreateCount}
              disabled={creating}
              className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              {creating ? "Creating..." : "Start New Weekly Count"}
            </button>
          </div>
        </div>
      </div>

      {draftToDelete && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <button
            type="button"
            aria-label="Close delete draft sheet"
            onClick={closeDeleteDraftSheet}
            className="absolute inset-0"
          />

          <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />

            <div className="mb-4 space-y-1">
              <div className="text-lg font-semibold">Delete Draft Count?</div>
              <div className="text-sm text-gray-500">
                This will permanently remove the draft for {formatCountDate(draftToDelete.count_date)}.
              </div>
            </div>

            <div className="flex flex-col gap-3 pb-4">
              <button
                type="button"
                onClick={confirmDeleteDraft}
                disabled={Boolean(deletingCountId)}
                className="w-full rounded bg-red-600 px-4 py-3 text-white disabled:opacity-50"
              >
                {deletingCountId ? "Deleting..." : "Delete Draft"}
              </button>

              <button
                type="button"
                onClick={closeDeleteDraftSheet}
                disabled={Boolean(deletingCountId)}
                className="w-full rounded border px-4 py-3 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}