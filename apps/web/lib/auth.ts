import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { createClient, schema } from "@faseela/db";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP, magicLink } from "better-auth/plugins";

import {
  EMAIL_SEND_CAP,
  EMAIL_SEND_PATHS,
  resolveAuthBaseUrl,
  sendCapDecision,
  trustedOrigins,
  IP_ADDRESS_HEADERS,
} from "./auth-config";
import { sendEmail } from "./email";
import { magicLinkEmail } from "./magic-link-email";
import { otpEmail } from "./otp-email";

/**
 * The server-side auth instance. Import this from Server Components, Server
 * Actions and Route Handlers; never from a Client Component, because it holds
 * the database pool and the signing secret.
 *
 * Better Auth owns `user`, `session`, `account` and `verification`, which are
 * declared in `@faseela/db` rather than generated here. That inversion is
 * deliberate: `packages/db` is the single description of the database, and
 * `npx auth@latest generate` would overwrite it — taking with it the
 * `anonymised_at` column and the partial unique index on `phone_number` that
 * ADR 0016 depends on. The CLI is therefore not part of this project's workflow.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See next.config.ts, which loads the root .env.local.");
}

const db = createClient(connectionString);

/**
 * Where the app is reachable. Better Auth signs and validates magic-link URLs
 * against this, so a mismatch produces links that 404 or fail verification —
 * which reads like a broken token rather than a misconfigured base URL.
 *
 * Throws at load in production when unset (or not https), exactly as
 * DATABASE_URL does above: a localhost fallback there would mail members links
 * to nowhere and set a non-Secure cookie, and nothing would look broken from
 * the inside. Development keeps the localhost fallback. See auth-config.ts.
 */
const baseURL = resolveAuthBaseUrl({
  nodeEnv: process.env.NODE_ENV,
  betterAuthUrl: process.env.BETTER_AUTH_URL,
  buildPhase: process.env.NEXT_PHASE === "phase-production-build",
});

export const auth = betterAuth({
  baseURL,

  /**
   * Production answers on two hosts — the canonical www.faseela24.com (which
   * `baseURL` names, so it is trusted by default) and faseela.vercel.app — and
   * both must be able to complete sign-in. Native (Expo) clients sign in over a
   * bearer token and the magic-link/OTP verify redirects back into the app by
   * URL scheme, so `faseela://` must be trusted too or Better Auth rejects the
   * callback as an untrusted redirect. Expo Go's `exp://` is not listed here:
   * the expo plugin below adds it itself, and only when NODE_ENV is
   * development. The list is a constant in auth-config.ts, where it is tested.
   */
  trustedOrigins: [...trustedOrigins],

  /**
   * Rate limiting, in the database.
   *
   * Better Auth's default store is a `Map` in the process — on Vercel that is
   * one map per lambda, so the plugins' caps (magic link 5/min, OTP 3/min per
   * IP) held per *instance* and an attacker fanned across instances was not
   * capped at all. The `rate_limit` table (packages/db, migration 0008) is the
   * only state every instance shares. Enabled explicitly rather than by
   * `NODE_ENV`, so development exercises the same code path production runs.
   *
   * `/get-session` is exempt: it runs on effectively every authenticated
   * request, it sends nothing and mints nothing, and a database round trip per
   * call would be paid by every page for no protection the platform needs.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: { "/get-session": false },
  },

  /** Which headers carry the client IP the limiter keys on — see auth-config.ts. */
  advanced: {
    ipAddress: { ipAddressHeaders: [...IP_ADDRESS_HEADERS] },
  },

  /**
   * A second cap, keyed on the *email address* rather than the caller's IP:
   * one inbox cannot be flooded with sign-in mail from many addresses. The
   * counter is a row in Better Auth's own `verification` table (identifier
   * `send-cap:<email>`), which Better Auth already prunes once expired, so no
   * new table and no new cleanup. The window arithmetic lives in
   * auth-config.ts and is tested there; this hook only reads and writes.
   * Read-then-write is not atomic — two simultaneous requests may both count
   * as the sixth — which is acceptable for a cap whose job is to stop floods,
   * not to be exact.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path || !EMAIL_SEND_PATHS.includes(ctx.path)) return;
      const raw: unknown = ctx.body?.email;
      if (typeof raw !== "string" || raw.trim() === "") return;
      const identifier = `send-cap:${raw.trim().toLowerCase()}`;

      const adapter = ctx.context.internalAdapter;
      const existing = await adapter.findVerificationValue(identifier);
      const now = Date.now();
      const decision = sendCapDecision(
        existing
          ? { count: Number(existing.value), expiresAt: existing.expiresAt.getTime() }
          : null,
        now,
        EMAIL_SEND_CAP,
      );

      if (!decision.allowed) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "طلبات كثيرة لهذا البريد. انتظر قليلاً ثم حاول مجدداً.",
        });
      }
      if (decision.reset) {
        if (existing) await adapter.deleteVerificationByIdentifier(identifier);
        await adapter.createVerificationValue({
          identifier,
          value: String(decision.count),
          expiresAt: new Date(decision.expiresAt),
        });
      } else {
        await adapter.updateVerificationByIdentifier(identifier, {
          value: String(decision.count),
        });
      }
    }),
  },

  /**
   * Signs session cookies and magic-link tokens. Distinct from `PAYLOAD_SECRET`
   * on purpose: the two systems authenticate different populations — Members and
   * Editors — and a single shared secret means rotating one logs out the other.
   */
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    /*
     * Our tables are singular (`user`, not `users`), which is the adapter's own
     * default, so no `usePlural` and no `modelName` remapping. Passing `schema`
     * explicitly also passes the *relations* declared alongside those tables,
     * which is what `experimental.joins` below requires.
     */
    schema,
  }),

  /**
   * Resolves a session and its user in one round trip instead of two. Neon is a
   * network hop from the app, which is exactly the condition where a second
   * query costs real latency; the adapter documents 2-3x on `/get-session`, and
   * `/get-session` runs on effectively every authenticated request.
   *
   * Marked experimental upstream. The fallback is two queries, not a failure.
   */
  experimental: { joins: true },

  session: {
    /**
     * Thirty days. Members are volunteers checking a Task list weekly, not
     * operators of a financial account; a seven-day session would mean a fresh
     * magic link most times someone returns, and since every sign-in requires
     * opening an email, short sessions convert directly into abandoned visits.
     */
    expiresIn: 60 * 60 * 24 * 30,
    /** Sliding window: any request within the last day extends the session. */
    updateAge: 60 * 60 * 24,
  },

  user: {
    /**
     * Erasure goes through `anonymiseMember`, never through Better Auth.
     *
     * Better Auth's own delete-user flow issues `DELETE FROM "user"`, which the
     * RESTRICT on `point_award.user_id` rejects (ADR 0016) — so leaving it
     * enabled offers Members a button that always errors. Disabled here so the
     * only path is the one that preserves the ledger.
     */
    deleteUser: { enabled: false },
  },

  /**
   * Email is the sole identifier: sign-in is magic link only, so an unverified
   * address cannot exist — possession of the link *is* the verification.
   */
  emailAndPassword: { enabled: false },

  plugins: [
    magicLink({
      /**
       * Ten minutes rather than the default five.
       *
       * Members are on Lebanese mobile networks, often on intermittent
       * connectivity, and frequently reading mail on a phone while the browser
       * that requested the link is on a laptop. Five minutes is a real risk of
       * expiry mid-flow; ten still leaves the link short-lived. Tokens are
       * single-use regardless, so the window bounds interception, not reuse.
       */
      expiresIn: 60 * 10,

      /**
       * Stored as a hash, not plaintext.
       *
       * A magic-link token is a bearer credential: whoever holds it becomes the
       * Member. Plaintext storage — the default — means anyone who can read the
       * `verification` table can sign in as anybody with a pending link. Hashing
       * costs nothing here because the token is never displayed after sending.
       */
      storeToken: "hashed",

      /*
       * `allowedAttempts` is deliberately absent. It is deprecated: tokens are
       * now consumed atomically on first use, and setting it to anything other
       * than 1 emits a startup warning while changing nothing.
       */

      sendMagicLink: async ({ email, url }) => {
        /*
         * Subject, plain-text and HTML bodies all come from one pure builder
         * (magic-link-email.ts). The console transport uses `text`; Resend sends
         * both. The URL's bidi-safe isolation and the client-safe (no-oklch)
         * HTML live there and are tested there.
         */
        const { subject, text, html } = magicLinkEmail({ url });
        await sendEmail({ to: email, subject, text, html });
      },
    }),

    /**
     * One-time sign-in codes for the mobile app (§1/§5). The phone requests a code,
     * receives it by email (the same Resend transport as the magic link above), and
     * types it in — chosen over an emailed link because the Expo client cannot
     * reliably deep-link an inbound email link back into the app. Web sign-in is
     * unaffected; it keeps using the magic link.
     */
    emailOTP({
      otpLength: 6,
      /** Ten minutes, matching the magic link — same Lebanese-mobile reasoning. */
      expiresIn: 60 * 10,
      async sendVerificationOTP({ email, otp }) {
        const { subject, text, html } = otpEmail({ otp });
        await sendEmail({ to: email, subject, text, html });
      },
    }),

    /**
     * Native (Expo) auth. Stores the session as a token the React Native client keeps
     * in `expo-secure-store` and replays on each request, because a phone has no
     * cookie jar. The web cookie flow is untouched — this plugin only engages for
     * requests the Expo client originates.
     */
    expo(),

    /**
     * Accept `Authorization: Bearer <token>` as a session, so the mobile client can
     * authenticate its API calls with the token the expo flow gave it. Cookie and
     * bearer sessions coexist; enabling this changes nothing for the web app, which
     * keeps using the cookie.
     */
    bearer(),

    /**
     * Must remain last in this array. It reads `Set-Cookie` off the response and
     * replays it through Next's `cookies()` helper, which is the only way a
     * Server Action can set a cookie. A plugin listed after it can produce
     * cookies that never reach the browser — and the symptom is a sign-in that
     * appears to succeed but leaves the member logged out.
     */
    nextCookies(),
  ],
});

/** The session shape, inferred so route handlers and components cannot drift from it. */
export type Session = typeof auth.$Infer.Session;
