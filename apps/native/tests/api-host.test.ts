import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PROD_FALLBACK, resolveBaseUrl } from "../lib/api";

/**
 * The app's last-resort host is the canonical domain, not the Vercel one: a
 * build shipped without `EXPO_PUBLIC_API_URL` must still sign in against the
 * origin whose cookies and magic links `BETTER_AUTH_URL` is set to. The release
 * profiles (preview, production) set that variable explicitly, so the fallback
 * is a safety net rather than the path a release takes; the development profile
 * must NOT set it, or a dev-client build could never reach a local `next dev`
 * (an explicit env wins over the Metro host in `resolveBaseUrl`).
 */
const CANONICAL = "https://www.faseela24.com";

describe("production host", () => {
  it("falls back to the canonical domain", () => {
    expect(PROD_FALLBACK).toBe(CANONICAL);
    expect(resolveBaseUrl({ isDev: false, fallback: PROD_FALLBACK })).toBe(CANONICAL);
  });

  it("still prefers the Metro host in dev over the fallback", () => {
    expect(resolveBaseUrl({ hostUri: "10.0.0.5:8081", isDev: true, fallback: PROD_FALLBACK })).toBe(
      "http://10.0.0.5:3000",
    );
  });

  it("is pinned by the release EAS profiles and left to Metro in development", () => {
    const eas = JSON.parse(readFileSync(join(__dirname, "../eas.json"), "utf8")) as {
      build: Record<string, { env?: Record<string, string> }>;
    };
    for (const profile of ["preview", "production"]) {
      expect(eas.build[profile]?.env?.EXPO_PUBLIC_API_URL, profile).toBe(CANONICAL);
    }
    expect(eas.build.development?.env?.EXPO_PUBLIC_API_URL).toBeUndefined();
  });
});
