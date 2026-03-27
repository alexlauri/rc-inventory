"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import HomeActionCard from "./components/HomeActionCard";

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
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
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
    }, 1000);

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
      openingRuns.find((run) => run.run_date === todayKey) ?? null
    );
  }, [openingRuns, todayKey]);

  const todaysClosingRun = useMemo(() => {
    return (
      closingRuns.find((run) => run.run_date === todayKey) ?? null
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
      <main
        className="flex min-h-screen w-full flex-col justify-between px-6 pb-10 pt-8"
        style={{ backgroundColor: "var(--color-surface-page, #F7F3EB)" }}
      >
        <div className="space-y-10">
          <div
            className="flex items-start justify-between pt-2 [font-family:var(--font-cabinet)]"
            style={{ color: "var(--color-primary, #004DEA)" }}
          >
            <div
              className="text-[18px] font-medium leading-none"
              style={{ color: "var(--color-primary, #004DEA)" }}
            >
              {currentUser?.name ?? "Manager"}
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("rc_user");
                }
                router.push("/login");
              }}
              className="transition active:scale-[0.95] -mt-3 -mr-2"
              style={{ color: "var(--color-primary, #004DEA)" }}
              aria-label="Log out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 40 40"
                fill="currentColor"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path d="M19.005 20C19.005 19.7348 19.1103 19.4804 19.2979 19.2929C19.4854 19.1054 19.7398 19 20.005 19H27.595L25.295 16.71C25.2017 16.6168 25.1278 16.5061 25.0773 16.3842C25.0269 16.2624 25.0009 16.1319 25.0009 16C25.0009 15.8681 25.0269 15.7376 25.0773 15.6158C25.1278 15.4939 25.2017 15.3832 25.295 15.29C25.3882 15.1968 25.4989 15.1228 25.6207 15.0723C25.7426 15.0219 25.8731 14.9959 26.005 14.9959C26.1368 14.9959 26.2674 15.0219 26.3892 15.0723C26.5111 15.1228 26.6217 15.1968 26.715 15.29L30.715 19.29C30.806 19.3851 30.8774 19.4972 30.925 19.62C31.025 19.8635 31.025 20.1365 30.925 20.38C30.8774 20.5028 30.806 20.6149 30.715 20.71L26.715 24.71C26.622 24.8037 26.5114 24.8781 26.3896 24.9289C26.2677 24.9797 26.137 25.0058 26.005 25.0058C25.873 25.0058 25.7423 24.9797 25.6204 24.9289C25.4986 24.8781 25.3879 24.8037 25.295 24.71C25.2013 24.617 25.1269 24.5064 25.0761 24.3846C25.0253 24.2627 24.9992 24.132 24.9992 24C24.9992 23.868 25.0253 23.7373 25.0761 23.6154C25.1269 23.4936 25.2013 23.383 25.295 23.29L27.595 21H20.005C19.7398 21 19.4854 20.8946 19.2979 20.7071C19.1103 20.5196 19.005 20.2652 19.005 20ZM20 10H12C11.2044 10 10.4413 10.3161 9.87868 10.8787C9.31607 11.4413 9 12.2044 9 13V27C9 27.7956 9.31607 28.5587 9.87868 29.1213C10.4413 29.6839 11.2044 30 12 30H20C20.7956 30 21.5587 29.6839 22.1213 29.1213C22.6839 28.5587 23 27.7956 23 27V24C23 23.7348 22.8946 23.4804 22.7071 23.2929C22.5196 23.1054 22.2652 23 22 23C21.7348 23 21.4804 23.1054 21.2929 23.2929C21.1054 23.4804 21 23.7348 21 24V27C21 27.2652 20.8946 27.5196 20.7071 27.7071C20.5196 27.8946 20.2652 28 20 28H12C11.7348 28 11.4804 27.8946 11.2929 27.7071C11.1054 27.5196 11 27.2652 11 27V13C11 12.7348 11.1054 12.4804 11.2929 12.2929C11.4804 12.1054 11.7348 12 12 12H20C20.2652 12 20.5196 12.1054 20.7071 12.2929C20.8946 12.4804 21 12.7348 21 13V16C21 16.2652 21.1054 16.5196 21.2929 16.7071C21.4804 16.8946 21.7348 17 22 17C22.2652 17 22.5196 16.8946 22.7071 16.7071C22.8946 16.5196 23 16.2652 23 16V13C23 12.2044 22.6839 11.4413 22.1213 10.8787C21.5587 10.3161 20.7956 10 20 10Z" />
              </svg>
            </button>
          </div>

          <div
            className="space-y-3 [font-family:var(--font-cabinet)] pt-6"
            style={{ color: "var(--color-primary, #004DEA)" }}
          >
            <div className="text-[116px] font-[750] uppercase leading-[0.9] tracking-[0em]">
              JOPLIN
            </div>

            <div className="flex items-baseline gap-3 text-[116px] font-[750] uppercase leading-[0.9] tracking-[0em]">
              OPS
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 63 83"
                fill="none"
                className="h-[86px] w-[86px] shrink-0 translate-y-3"
                aria-hidden="true"
              >
                <path d="M61.4571 19.4221C60.244 18.8265 57.0626 17.4293 53.3776 14.4286C47.7357 9.83603 48.0218 1.06314 42.6088 0.158359C34.6666 -1.17017 30.5124 6.29709 30.5124 6.29709C29.1849 2.74671 25.8433 1.63578 24.2182 1.64723C16.4706 1.7045 12.717 10.2598 11.5268 13.6727C10.8974 15.4594 10.0848 17.1888 9.05488 18.7693C3.57319 27.1757 -2.85836 26.6145 1.36449 30.0389C5.38135 33.2915 5.91921 36.9106 5.87344 38.8118C5.82766 40.7015 5.9421 42.5912 6.26254 44.4466C8.91755 59.885 18.2902 62.8742 25.9348 62.7253C30.3751 67.7646 36.0857 72.0022 42.1053 72.8039C45.9848 73.3192 49.2578 73.01 51.9471 72.0823C51.6725 73.0215 51.4207 74.0179 51.2261 74.9799C51.0316 75.9419 50.9172 76.9154 51.1117 77.9004C51.455 79.9046 53.0801 81.5882 55.0484 81.8974C55.9296 82.0463 56.8337 81.9432 57.5776 81.5309C57.692 81.4622 57.7836 81.3591 57.8293 81.2217C57.8866 81.0155 57.8179 80.8094 57.6577 80.672C54.9455 81.1072 52.382 78.7135 54.2588 73.9606C55.6435 70.456 56.6621 67.6157 50.6654 69.4138C49.6469 69.7001 48.5711 69.8834 47.4153 69.975C45.7216 70.1124 44.0164 70.0094 42.0824 69.8376C33.3506 69.0817 24.7675 58.1671 24.4013 51.6619C24.1152 46.5653 26.7817 45.7407 29.4481 45.9927C33.7511 46.3936 34.5064 58.5107 34.9413 61.3853C35.6623 66.1841 37.7794 65.7374 38.5462 64.0882C39.908 61.1334 40.2971 54.5022 44.2682 52.9102C46.8431 51.8795 49.4294 54.7312 51.1346 55.5787C56.7994 58.4305 49.0289 46.7142 51.7411 47.0006C55.1171 47.3556 57.4403 50.0814 58.6075 53.3454C60.1525 56.9645 59.4887 61.6717 59.3056 66.2643C63.6086 59.1635 61.4457 48.1688 53.4806 41.7551C52.0272 40.587 50.7569 39.5677 49.6698 38.64C52.2561 31.8255 60.244 24.2323 62.0522 21.4607C62.5214 20.7391 62.2467 19.7886 61.4686 19.4106L61.4571 19.4221ZM47.5869 36.7388C47.6899 36.8533 47.8044 36.9564 47.9188 37.0709C47.8044 36.9564 47.6899 36.8419 47.5869 36.7388ZM46.6714 35.6851C46.7401 35.7768 46.8202 35.8684 46.9003 35.96C46.8202 35.8684 46.7515 35.7768 46.6714 35.6851ZM46.9346 36.0173C47.0262 36.1203 47.1177 36.2349 47.2093 36.3379C47.1063 36.2349 47.0147 36.1203 46.9346 36.0173ZM49.2234 38.2735C49.3608 38.3995 49.5095 38.5254 49.6583 38.6514C49.5095 38.5254 49.3722 38.3995 49.2234 38.2735ZM48.3537 37.4947C48.4796 37.6092 48.6055 37.7237 48.7313 37.8497C48.6055 37.7352 48.4681 37.6092 48.3537 37.4947ZM46.6371 35.6508C44.0965 32.3523 45.5041 29.6838 52.6109 23.9345C52.6109 23.9345 49.2349 23.442 47.0605 21.3805C47.0605 21.3805 47.0376 24.1063 41.2927 25.5264C38.4317 26.2251 35.2159 26.8779 32.0231 27.1986C30.6383 38.8003 39.702 44.2977 39.702 44.2977C30.6841 39.0637 28.4182 32.2264 28.1092 27.3933C23.9665 27.3818 20.1785 26.5687 17.6722 24.2666C17.6722 24.2666 14.3992 36.7502 17.4434 48.2146C17.7638 49.4171 18.2788 50.7915 18.9654 52.246C15.7039 50.9632 13.2777 48.0542 12.6826 44.5038L11.893 39.854C11.0233 36.0058 9.18076 32.4325 6.52575 29.512L4.72904 27.5307C4.72904 27.5307 10.7143 22.3196 14.7769 16.8566C18.851 11.3822 23.3828 18.1623 27.7315 17.498C32.0803 16.8337 35.0443 13.1344 39.5189 14.0278C43.9935 14.9325 49.933 24.7362 55.0942 22.4342C55.0942 22.4342 50.1618 28.6531 46.6485 35.6508H46.6371Z" fill="currentColor" />
                <path d="M56.2843 76.377C55.9524 76.6289 55.9066 77.1099 56.1927 77.4192C56.4559 77.7055 56.9023 77.7169 57.1884 77.4535C59.6717 75.1057 58.6418 69.8488 57.3257 67.1001C57.1998 66.8482 56.8221 67.02 56.9137 67.2719C57.2112 68.0507 57.4058 68.8753 57.5431 69.6999C57.7949 71.3033 57.8521 73.0213 57.4058 74.5674C57.1884 75.3118 56.8107 75.9761 56.2957 76.3655L56.2843 76.377Z" fill="currentColor" />
                <path d="M44.9038 20.0411C44.7664 19.9151 44.6291 19.8006 44.4918 19.6746C42.6035 18.0025 40.6466 16.2731 39.2275 15.9983C38.7011 15.8952 38.1976 15.8608 37.6711 15.9066C36.172 16.0326 34.7415 16.7541 33.2309 17.51C31.6172 18.3232 29.9579 19.1707 27.9437 19.4799C27.8178 19.5028 27.6919 19.5143 27.5546 19.5257C25.5977 19.6861 23.8239 18.8157 22.0958 17.9681C20.6767 17.281 19.3492 16.6282 18.2277 16.7198C17.7127 16.7656 16.9002 16.9717 15.9275 18.2774C15.0348 19.4685 14.0735 20.6481 13.0894 21.759C13.6501 22.5836 15.1722 23.1219 16.1678 22.9501C17.6097 22.6982 17.9988 21.8736 17.9988 21.8736C17.9988 21.8736 19.8528 26.8556 25.4031 24.9887C28.493 23.9465 28.9393 22.0797 28.9393 22.0797C28.9393 22.0797 30.5987 25.4354 34.6499 24.7711C38.7011 24.1183 40.2346 20.8772 40.2346 20.8772C40.2346 20.8772 40.555 24.1641 43.9081 23.7633C44.6177 23.6717 45.167 23.2479 45.4645 22.6524C45.8994 21.7705 45.6476 20.6939 44.9152 20.0411H44.9038Z" fill="currentColor" />
              </svg>
            </div>

            <div className="text-[116px] font-[750] uppercase leading-[0.9] tracking-[0em]">
              MAR.
            </div>

            <div className="text-[116px] font-[750] leading-[0.9] tracking-[0em]">
              {new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(now)}
            </div>

            <div className="text-[116px] font-[750] leading-[0.98] tracking-[-0.005em] tabular-nums">
              {now
                .toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })
                .replace(/\s?(AM|PM)$/i, "")}
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-8">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <HomeActionCard
            title="Open"
            subtitle={
              loading
                ? "Loading..."
                : openingSubmitted
                ? "Completed"
                : todaysOpeningRun
                ? "Resume checklist"
                : "Start checklist"
            }
            onClick={() => void handleStaffOpen()}
            disabled={loading}
            completed={openingSubmitted}
          />

          <HomeActionCard
            title="Close"
            subtitle={
              loading
                ? "Loading..."
                : closingSubmitted
                ? "Completed"
                : todaysClosingRun
                ? "Resume checklist"
                : "Start checklist"
            }
            onClick={() => void handleStaffClose()}
            disabled={loading}
            completed={closingSubmitted}
          />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-md space-y-6 p-4 pb-32">
        <div className="space-y-2">
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: "var(--color-primary, #004DEA)" }}
          >
            Operations
          </h1>
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
              <div
                className="text-sm font-medium uppercase tracking-wide"
                style={{ color: "var(--color-primary, #004DEA)" }}
              >
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
              <div
                className="text-sm font-medium uppercase tracking-wide"
                style={{ color: "var(--color-primary, #004DEA)" }}
              >
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
          <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-[color:var(--color-primary)]/10 backdrop-blur">
            <div className="flex gap-2">
              <button
                onClick={() => void handleCreateOpeningRun()}
                className="w-1/2 rounded-xl border border-[var(--color-primary)] px-4 py-3 font-medium text-[var(--color-primary)] shadow-sm transition active:scale-[0.99]"
              >
                Start Opening
              </button>

              <button
                onClick={() => void handleCreateClosingRun()}
                className="w-1/2 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-medium text-white shadow-sm transition active:scale-[0.99]"
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