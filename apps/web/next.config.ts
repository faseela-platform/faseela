import { fileURLToPath } from 'node:url';

import { withPayload } from '@payloadcms/next/withPayload';
import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

/**
 * Secrets live in the repo-root `.env.local`, not in `apps/web`, because
 * `packages/db`, its test harness and the verification scripts all read the same
 * connection strings — duplicating them into a second file guarantees the two
 * drift apart, and the copy that is wrong will be the one production uses.
 *
 * Next.js only auto-loads `.env*` from the app directory, so it is loaded here.
 * This runs before the Payload config is evaluated, which is what makes
 * `PAYLOAD_SECRET` present; without it the admin panel throws
 * "missing secret key" on first render.
 */
loadEnv({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)) });

const nextConfig: NextConfig = {
  /**
   * `sharp` and the Postgres driver are native and must not be bundled into the
   * server build. Payload's plugin covers most of this; naming the two that
   * actually matter makes a future bundling error diagnosable rather than
   * mysterious.
   */
  serverExternalPackages: ['sharp', 'pg'],
};

/**
 * `withPayload` is what lets Next.js resolve Payload's admin routes and its
 * drizzle-kit dependency. Payload is ESM-only, hence ESM syntax throughout.
 */
export default withPayload(nextConfig);
