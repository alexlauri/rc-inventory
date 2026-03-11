"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LoggedInUser = {
  id: string;
  name: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("rc_user");

    if (stored) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      const text = await res.text();
      let json: { error?: string; user?: LoggedInUser } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.user) {
        throw new Error(json.error || "Login failed");
      }

      window.localStorage.setItem("rc_user", JSON.stringify(json.user));
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Staff Login</h1>
          <p className="text-sm text-gray-600">
            Enter your PIN to access Rolling Cones inventory.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded border px-3 py-3 text-lg tracking-[0.3em]"
              placeholder="••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium disabled:opacity-50"
          >
            {submitting ? "Signing In..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}