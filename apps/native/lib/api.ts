/**
 * Pure API plumbing — importable under plain node (no react-native imports).
 * `apiFetch` at the bottom composes the two pure functions; components pass in
 * what they read from `Constants` and `__DEV__`.
 */

export const PROD_FALLBACK = "https://faseela.vercel.app";

/**
 * Where the API lives, in precedence order: an explicit `EXPO_PUBLIC_API_URL`
 * wins outright; in dev the Metro `hostUri` points at the machine running
 * `next dev`, so swap Metro's port for 3000; otherwise production.
 */
export function resolveBaseUrl(opts: {
  envUrl?: string;
  hostUri?: string;
  isDev: boolean;
  fallback: string;
}): string {
  if (opts.envUrl) {
    return opts.envUrl.replace(/\/+$/, "");
  }
  if (opts.isDev && opts.hostUri) {
    const host = opts.hostUri.split(":")[0];
    return `http://${host}:3000`;
  }
  return opts.fallback;
}

/**
 * Narrows the `{data}` / `{error:{code,message}}` wire envelope. Anything that
 * is neither — non-objects, half-formed errors — maps to code `"malformed"`:
 * a misbehaving server must read as a connection-level failure, never a crash.
 * The server `message` is dropped on purpose; the UI localizes from `code`.
 */
export function parseEnvelope<T>(
  json: unknown,
): { ok: true; data: T } | { ok: false; code: string } {
  if (typeof json !== "object" || json === null) {
    return { ok: false, code: "malformed" };
  }
  if ("data" in json) {
    return { ok: true, data: (json as { data: T }).data };
  }
  if ("error" in json) {
    const error = (json as { error: unknown }).error;
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: unknown }).code;
      if (typeof code === "string") {
        return { ok: false, code };
      }
    }
  }
  return { ok: false, code: "malformed" };
}

/**
 * Fetch a `/api/v1/*` path and narrow its envelope. Network and JSON failures
 * collapse into the same shape as server errors — one failure surface for the
 * screens: `{ ok: false, code }` with code `"network"` for anything thrown.
 */
export async function apiFetch<T>(
  baseUrl: string,
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; code: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      headers: { accept: "application/json" },
    });
    const json: unknown = await response.json();
    return parseEnvelope<T>(json);
  } catch {
    return { ok: false, code: "network" };
  }
}
