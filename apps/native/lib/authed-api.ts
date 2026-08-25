import { parseEnvelope } from "./api";
import { baseUrl, sessionCookie } from "./auth-client";

/**
 * Call an authenticated `/api/v1/*` endpoint, carrying the session the expo client
 * stored. `authClient.getCookie()` returns that session as the `Cookie` header the
 * server's `getSession` reads — the same session the web sends in a browser cookie.
 *
 * Narrows the envelope and collapses every failure into `{ ok:false, code }` — the
 * same one surface the read-only `apiFetch` gives, so screens handle one shape. An
 * `unauthenticated` code comes back if the token is missing or stale.
 */
export async function authedFetch<T>(
  path: string,
  opts?: { method?: "GET" | "POST"; body?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; code: string }> {
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (opts?.body !== undefined) headers["content-type"] = "application/json";
    const cookie = sessionCookie();
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method: opts?.method ?? "GET",
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json: unknown = await res.json();
    return parseEnvelope<T>(json);
  } catch {
    return { ok: false, code: "network" };
  }
}
