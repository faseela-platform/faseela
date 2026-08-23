/**
 * Reduce a caller-supplied redirect target to a same-site path, or fall back.
 *
 * This is an open-redirect guard, and it is not theoretical: the value is
 * attacker-controllable (a `?next=`/`?callbackURL=` param), it is handed to the
 * router and, for magic links, into an email the Member is told to trust.
 * Without it, `?next=https://evil.example` produces a genuine Faseela redirect
 * that lands the Member on somebody else's site, already authenticated.
 *
 * Allow-listing the shape rather than blocking bad values: it must start with a
 * single `/` and not `//` (which excludes absolute and protocol-relative URLs),
 * and contain no `\` (some clients normalise it to `/`).
 *
 * Guarded by safe-path.test.ts.
 */
export function safeInternalPath(raw: string | undefined, fallback = "/masarat"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
