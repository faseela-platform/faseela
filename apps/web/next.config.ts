import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

/**
 * Secrets live in the repo-root `.env.local`, not in `apps/web`, because
 * `packages/db`, its test harness and the verification scripts all read the same
 * connection strings — duplicating them into a second file guarantees the two
 * drift apart, and the copy that is wrong will be the one production uses.
 *
 * Next.js only auto-loads `.env*` from the app directory (here `apps/web`), so the
 * repo-root file is loaded explicitly. `DATABASE_URL` and `BETTER_AUTH_*` must be
 * present before the app's server code (auth, the data layer) is evaluated.
 *
 * On a deployment platform the file does not exist and the variables come from the
 * environment instead. `dotenv` treats a missing file as a no-op rather than an
 * error, so this is safe there, and it never overwrites a variable that is already
 * set — meaning a stray local file could not shadow production configuration even if
 * one were committed by accident.
 */
loadEnv({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)) });

const nextConfig: NextConfig = {
  /**
   * The Postgres driver is native and must not be bundled into the server build;
   * naming it makes a future bundling error diagnosable rather than mysterious.
   */
  serverExternalPackages: ["pg"],
};

export default nextConfig;
