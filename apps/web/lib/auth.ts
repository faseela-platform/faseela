import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createClient, schema } from "@faseela/db";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { sendEmail } from "./email";
import { magicLinkEmail } from "./magic-link-email";

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
 */
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL,

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
