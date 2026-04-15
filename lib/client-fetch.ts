/**
 * Absolute URL to the current origin so `/api/...` requests behave reliably on
 * mobile browsers and tunnels where relative resolution can misbehave.
 */
export function clientApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(path, window.location.origin).href;
}

export function fetchErrorToUserMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Something went wrong. Please try again.";
  }
  const raw = err.message;
  const m = raw.toLowerCase();
  if (
    raw === "Failed to fetch" ||
    m.includes("fetch failed") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed") ||
    m.includes("econnrefused")
  ) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return raw;
}
