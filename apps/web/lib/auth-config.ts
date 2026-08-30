/**
 * The pure parts of the auth configuration — what `auth.ts` feeds Better Auth
 * that can be reasoned about without a database or a request. Kept out of
 * `auth.ts` so they are testable: that file holds the connection pool and the
 * signing secret and cannot be imported by a unit test.
 *
 * Guarded by auth-config.test.ts.
 */

/** Where production lives. Cookies, magic links and the native app all point here. */
export const CANONICAL_ORIGIN = "https://www.faseela24.com";

/** The Vercel-assigned host still answers; sign-in from it must keep working. */
export const VERCEL_ORIGIN = "https://faseela.vercel.app";

/**
 * Origins Better Auth accepts callbacks and cross-origin requests from, beyond
 * `baseURL` (which it trusts on its own). `faseela://` is the native app's
 * scheme — the magic-link and OTP flows redirect back into it. Expo Go's
 * `exp://` is deliberately absent: `@better-auth/expo` adds it itself, and only
 * when `NODE_ENV` is `development`, which is exactly the scope it should have.
 */
export const trustedOrigins: readonly string[] = [CANONICAL_ORIGIN, VERCEL_ORIGIN, "faseela://"];

/**
 * The base URL Better Auth signs magic links against and derives cookie
 * attributes from. In production it must be set and must be https: a fallback
 * to localhost would mail members links to nowhere and set a non-Secure
 * cookie, and — as with a silently no-op email transport (ADR 0018) — nothing
 * would look broken from the inside. So it throws at load, like DATABASE_URL.
 */
export function resolveAuthBaseUrl(env: {
  nodeEnv: string | undefined;
  betterAuthUrl: string | undefined;
  /**
   * `next build` evaluates route modules with NODE_ENV=production and no runtime
   * env (CI has none; Vercel injects it only at request time), so the check must
   * not fire there — the built artifact is not the served process. Pass
   * `process.env.NEXT_PHASE === "phase-production-build"`.
   */
  buildPhase?: boolean;
}): string {
  const configured = env.betterAuthUrl?.trim();
  if (env.nodeEnv !== "production") return configured || "http://localhost:3000";
  if (env.buildPhase) return configured || CANONICAL_ORIGIN;
  if (!configured) {
    throw new Error(
      `BETTER_AUTH_URL is not set. In production it must be the public origin, ${CANONICAL_ORIGIN}; without it magic links point at localhost and the session cookie is not Secure.`,
    );
  }
  if (!configured.startsWith("https://")) {
    throw new Error(
      `BETTER_AUTH_URL must be an https origin in production (got ${configured}); the session cookie is only Secure over https.`,
    );
  }
  return configured;
}

/**
 * Where the client IP is read from for rate limiting. Vercel sets `x-real-ip` and
 * a single-value `x-forwarded-for` from the connection itself (client-supplied
 * values are overwritten), so both are trustworthy here. Better Auth trusts only a
 * single-value forwarded header without `trustedProxies`, and keys every request
 * on a shared `no-trusted-ip` bucket when no header resolves — which would let one
 * caller exhaust sign-in for everyone. Nothing fronts the site today (no
 * Cloudflare); if a proxy is ever added, `trustedProxies` must name it.
 */
export const IP_ADDRESS_HEADERS: readonly string[] = ["x-real-ip", "x-forwarded-for"];

/**
 * The Better Auth endpoints that cause an email to be sent. Better Auth's own
 * limiter keys on IP + path; these get a second cap keyed on the *address*, so
 * one inbox cannot be flooded from many IPs.
 */
export const EMAIL_SEND_PATHS: readonly string[] = [
  "/sign-in/magic-link",
  "/email-otp/send-verification-otp",
];

export type SendCapRule = { max: number; windowMs: number };

/**
 * Six sends per address per half hour, across magic link and OTP together. A
 * member who mistypes, retries, and switches to the app still fits; a script
 * hammering one address does not.
 */
export const EMAIL_SEND_CAP: SendCapRule = { max: 6, windowMs: 30 * 60 * 1000 };

export type SendCapRecord = { count: number; expiresAt: number };

export type SendCapDecision = {
  allowed: boolean;
  /** True when a new window starts: the caller replaces the record. */
  reset: boolean;
  /** The count the record should hold after this decision. */
  count: number;
  expiresAt: number;
};

/**
 * Fixed-window decision for one address. A missing or expired record opens a
 * fresh window at count 1; an open window increments until `max`, then refuses.
 * A count that is not a number is treated as full — a corrupt record must fail
 * closed, not open.
 */
export function sendCapDecision(
  existing: SendCapRecord | null,
  now: number,
  rule: SendCapRule,
): SendCapDecision {
  if (!existing || existing.expiresAt <= now) {
    return { allowed: true, reset: true, count: 1, expiresAt: now + rule.windowMs };
  }
  if (!Number.isFinite(existing.count) || existing.count >= rule.max) {
    return { allowed: false, reset: false, count: existing.count, expiresAt: existing.expiresAt };
  }
  return {
    allowed: true,
    reset: false,
    count: existing.count + 1,
    expiresAt: existing.expiresAt,
  };
}
