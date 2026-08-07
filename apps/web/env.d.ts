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
    /** Signs Payload's admin session cookies. Rotating it logs every Editor out. */
    PAYLOAD_SECRET: string;
    /** Signs Member session cookies and magic-link tokens. Distinct from PAYLOAD_SECRET. */
    BETTER_AUTH_SECRET: string;
    /**
     * Where the app is reachable. Magic-link URLs are built from it, so in
     * production this must be the public origin — a stale value produces links
     * that fail verification, which reads as a token bug rather than config.
     */
    BETTER_AUTH_URL: string;
  }
}
