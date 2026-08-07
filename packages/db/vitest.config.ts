import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * PGlite boots a WASM Postgres and applies 35 migration statements per
     * suite. On a warm machine that is ~3s; under `turbo run test` it competes
     * with the other packages' suites for cores and exceeded vitest's 10s
     * default, which surfaced as a flake that passed when the package was run
     * alone and failed in `pnpm check`.
     *
     * Raised rather than worked around: a real database is the point of these
     * tests (see tests/awards.test.ts), and its startup cost is real.
     */
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
