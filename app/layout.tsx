"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

type LoggedInUser = {
  id: string;
  name: string;
  role?: string;
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const isAdmin = (user?.role ?? "").trim().toLowerCase() === "admin";

  useEffect(() => {
    const stored = window.localStorage.getItem("rc_user");

    if (pathname === "/login") {
      setCheckedAuth(true);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      }
      return;
    }

    if (!stored) {
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as LoggedInUser;
      setUser(parsed);
      setCheckedAuth(true);
    } catch {
      window.localStorage.removeItem("rc_user");
      router.replace("/login");
    }
  }, [pathname, router]);

  function handleLogout() {
    window.localStorage.removeItem("rc_user");
    setUser(null);
    router.replace("/login");
  }

  if (!checkedAuth && pathname !== "/login") {
    return (
      <html lang="en">
        <body className="bg-white text-black" />
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-white text-black">
        <div className="mx-auto min-h-screen max-w-md">
          {pathname !== "/login" && (
            <header className="sticky top-0 z-10 border-b bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  {isAdmin ? (
                    <>
                      <Link href="/" className="font-semibold">
                        Counts
                      </Link>
                      <Link href="/admin" className="font-semibold text-gray-600">
                        Admin
                      </Link>
                    </>
                  ) : (
                    user?.name && (
                      <div className="text-sm text-gray-500">
                        {user.name}
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-gray-600 underline"
                >
                  Log out
                </button>
              </div>
            </header>
          )}

          <div>{children}</div>
        </div>
      </body>
    </html>
  );
}