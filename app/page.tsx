"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ChecklistRun = {
  id: string;
  run_date: string;
  status: string;
  submitted_by_name: string | null;
  created_at: string;
};

type StoredUser = {
  id?: string;
  name?: string;
  pin?: string;
  role?: string;
  active?: boolean;
};

function formatRunDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRunStatusMeta(run: ChecklistRun) {
  if (run.status === "submitted") {
    return {
      label: "Submitted",
      classes: "border-green-200 bg-green-50 text-green-700",
    };
  }

  return {
    label: "Draft",
    classes: "border-yellow-200 bg-yellow-50 text-yellow-700",
  };
}

function formatStaffDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

function formatStaffTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLocalDateKey(dateInput: string | Date) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAdminUser(user: StoredUser | null) {
  return (user?.role ?? "").trim().toLowerCase() === "admin";
}

export default function HomePage() {
  const router = useRouter();
  const [openingRuns, setOpeningRuns] = useState<ChecklistRun[]>([]);
  const [closingRuns, setClosingRuns] = useState<ChecklistRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [userResolved, setUserResolved] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("rc_user");

    if (!raw) {
      setCurrentUser(null);
      setUserResolved(true);
      return;
    }

    try {
      setCurrentUser(JSON.parse(raw) as StoredUser);
    } catch {
      setCurrentUser(null);
    } finally {
      setUserResolved(true);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000 * 30);

    return () => window.clearInterval(interval);
  }, []);

  const isAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  async function loadRuns(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    try {
      setError(null);
      if (!silent) {
        setLoading(true);
      }

      const supabase = createClient();

      const [openingResult, closingResult] = await Promise.all([
        supabase
          .from("opening_runs")
          .select("id, run_date, status, submitted_by_name, created_at")
          .order("run_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("closing_runs")
          .select("id, run_date, status, submitted_by_name, created_at")
          .order("run_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (openingResult.error) {
        throw new Error(openingResult.error.message || "Failed to load opening runs");
      }

      if (closingResult.error) {
        throw new Error(closingResult.error.message || "Failed to load closing runs");
      }

      setOpeningRuns(openingResult.data ?? []);
      setClosingRuns(closingResult.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function handleCreateClosingRun() {
    try {
      setError(null);

      const res = await fetch("/api/closing", {
        method: "POST",
      });

      const text = await res.text();
      let json: { error?: string; run?: { id: string } } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.run?.id) {
        throw new Error(json.error || "Failed to create closing run");
      }

      router.push(`/closing/${json.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create closing run");
    }
  }

  async function handleCreateOpeningRun() {
    try {
      setError(null);

      const res = await fetch("/api/opening", {
        method: "POST",
      });

      const text = await res.text();
      let json: { error?: string; run?: { id: string } } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.run?.id) {
        throw new Error(json.error || "Failed to create opening run");
      }

      router.push(`/opening/${json.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create opening run");
    }
  }

  useEffect(() => {
    void loadRuns();

    const interval = window.setInterval(() => {
      void loadRuns({ silent: true });
    }, 2000);

    const handleFocus = () => {
      if (document.visibilityState === "hidden") return;
      void loadRuns({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const todayKey = useMemo(() => {
    return getLocalDateKey(now);
  }, [now]);

  const todaysOpeningRun = useMemo(() => {
    return (
      openingRuns.find((run) => getLocalDateKey(run.created_at) === todayKey) ?? null
    );
  }, [openingRuns, todayKey]);

  const todaysClosingRun = useMemo(() => {
    return (
      closingRuns.find((run) => getLocalDateKey(run.created_at) === todayKey) ?? null
    );
  }, [closingRuns, todayKey]);

  async function handleStaffOpen() {
    if (todaysOpeningRun) {
      router.push(`/opening/${todaysOpeningRun.id}`);
      return;
    }

    await handleCreateOpeningRun();
  }

  async function handleStaffClose() {
    if (todaysClosingRun) {
      router.push(`/closing/${todaysClosingRun.id}`);
      return;
    }

    await handleCreateClosingRun();
  }

  const openingSubmitted = todaysOpeningRun?.status === "submitted";
  const closingSubmitted = todaysClosingRun?.status === "submitted";

  if (!userResolved) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-4">
        <div className="text-sm text-gray-600">Loading...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between p-4 pb-10">
        <div className="space-y-2 pt-6">
          <div className="text-4xl font-semibold tracking-tight">{formatStaffDate(now)}</div>
          <div className="text-xl text-gray-500">{formatStaffTime(now)}</div>
        </div>

        <div className="space-y-4 pb-8">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleStaffOpen()}
            disabled={loading}
            className={`w-full rounded-3xl border px-6 py-8 text-left shadow-sm transition active:scale-[0.99] ${
              openingSubmitted
                ? "border-green-200 bg-green-50 text-green-700"
                : "bg-white text-gray-900"
            }`}
          >
            <div className="text-3xl font-semibold">Open</div>
            <div className="mt-2 text-sm text-gray-500">
              {loading
                ? "Loading..."
                : openingSubmitted
                ? "Completed"
                : todaysOpeningRun
                ? "Resume checklist"
                : "Start checklist"}
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleStaffClose()}
            disabled={loading}
            className={`w-full rounded-3xl border px-6 py-8 text-left shadow-sm transition active:scale-[0.99] ${
              closingSubmitted
                ? "border-green-200 bg-green-50 text-green-700"
                : "bg-white text-gray-900"
            }`}
          >
            <div className="text-3xl font-semibold">Close</div>
            <div className="mt-2 text-sm text-gray-500">
              {loading
                ? "Loading..."
                : closingSubmitted
                ? "Completed"
                : todaysClosingRun
                ? "Resume checklist"
                : "Start checklist"}
            </div>
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-md space-y-6 p-4 pb-32">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Operations</h1>
          <p className="text-sm text-gray-500">
            Opening and closing checklists for service.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading operations...</div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Recent Closing Checklists
              </div>
              {closingRuns.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
                  No closing checklists yet.
                </div>
              ) : (
                closingRuns.map((run) => {
                  const status = getRunStatusMeta(run);

                  return (
                    <div
                      key={run.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/closing/${run.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/closing/${run.id}`);
                        }
                      }}
                      className="cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium">{formatRunDate(run.run_date)}</div>
                          {run.submitted_by_name && (
                            <div className="text-sm text-gray-600">
                              Submitted by {run.submitted_by_name}
                            </div>
                          )}
                        </div>

                        <div
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.classes}`}
                        >
                          {status.label}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Recent Opening Checklists
              </div>
              {openingRuns.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-600">
                  No opening checklists yet.
                </div>
              ) : (
                openingRuns.map((run) => {
                  const status = getRunStatusMeta(run);

                  return (
                    <div
                      key={run.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/opening/${run.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/opening/${run.id}`);
                        }
                      }}
                      className="cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium">{formatRunDate(run.run_date)}</div>
                          {run.submitted_by_name && (
                            <div className="text-sm text-gray-600">
                              Submitted by {run.submitted_by_name}
                            </div>
                          )}
                        </div>

                        <div
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.classes}`}
                        >
                          {status.label}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
          <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <div className="flex gap-2">
              <button
                onClick={() => void handleCreateOpeningRun()}
                className="w-1/2 rounded-xl border px-4 py-3 font-medium text-gray-900 shadow-sm transition active:scale-[0.99]"
              >
                Start Opening
              </button>

              <button
                onClick={() => void handleCreateClosingRun()}
                className="w-1/2 rounded-xl bg-black px-4 py-3 font-medium text-white shadow-sm transition active:scale-[0.99]"
              >
                Start Closing
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}