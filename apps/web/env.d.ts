/**
 * The environment variables `apps/web` actually depends on, declared so that a
 * missing one is a typecheck failure rather than a 500 at runtime.
 *
 * Next.js only auto-loads `.env*` files from the app directory, not from a
 * monorepo root. The secrets live in the repo-root `.env.local` because
 * `packages/db` and its scripts need them too, so `next.config.ts` loads that
 * file explicitly — see the `loadEnv` call there.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Pooled Neon host. PgBouncer transaction mode — application queries only. */
    DATABASE_URL: string;
    /** Unpooled Neon host. Required for DDL: migrations need session state. */
    DATABASE_URL_UNPOOLED: string;
    /** Signs Member (and Editor) session cookies and magic-link tokens. */
    BETTER_AUTH_SECRET: string;
    /**
     * Where the app is reachable. Magic-link URLs are built from it and the
     * session cookie's Secure attribute follows it, so in production this must
     * be the canonical public origin, `https://www.faseela24.com` — a stale
     * value produces links that fail verification, which reads as a token bug
     * rather than config. `lib/auth.ts` throws at load in production when it is
     * unset or not https; development falls back to http://localhost:3000.
     */
    BETTER_AUTH_URL: string;

    /**
     * Cloudflare R2, for the files Members submit (see `lib/r2.ts`). Optional:
     * when unset, `r2IsConfigured` is false and submissions degrade to text only,
     * so a local checkout needs none of these. All four are required together.
     */
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
  }
}
