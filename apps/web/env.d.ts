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
  }
}
