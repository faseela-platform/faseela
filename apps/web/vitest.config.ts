import { defineConfig } from "vitest/config";

/**
 * Unit tests for the app's pure server-side helpers (`lib/*.test.ts`) — the
 * email transport selector and the magic-link template. Scoped to `lib/` on
 * purpose: the rest of `apps/web` is Next.js Server/Client Components that are
 * exercised by the `verify:*` scripts against a running server, not by Vitest.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
