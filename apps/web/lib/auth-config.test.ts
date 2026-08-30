import { describe, expect, it } from "vitest";

import {
  CANONICAL_ORIGIN,
  EMAIL_SEND_CAP,
  EMAIL_SEND_PATHS,
  IP_ADDRESS_HEADERS,
  resolveAuthBaseUrl,
  sendCapDecision,
  trustedOrigins,
} from "./auth-config";

/**
 * `BETTER_AUTH_URL` decides what the magic link points at and whether the
 * session cookie is Secure. A production process that falls back to
 * `http://localhost:3000` would mail members links to nowhere and set a
 * non-Secure cookie — the same class of silent failure ADR 0018 refuses for
 * email, so it must throw at load, exactly like a missing DATABASE_URL.
 */
describe("resolveAuthBaseUrl", () => {
  it("uses the configured URL when set", () => {
    expect(
      resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: "https://www.faseela24.com" }),
    ).toBe("https://www.faseela24.com");
  });

  it("falls back to localhost outside production", () => {
    expect(resolveAuthBaseUrl({ nodeEnv: "development", betterAuthUrl: undefined })).toBe(
      "http://localhost:3000",
    );
    expect(resolveAuthBaseUrl({ nodeEnv: "test", betterAuthUrl: "" })).toBe(
      "http://localhost:3000",
    );
  });

  it("throws in production when unset or empty", () => {
    expect(() => resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: undefined })).toThrow(
      /BETTER_AUTH_URL/,
    );
    expect(() => resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: "" })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it("throws in production when the URL is not https", () => {
    expect(() =>
      resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: "http://localhost:3000" }),
    ).toThrow(/https/);
  });
});

/**
 * Production answers on two hosts — the canonical domain and the Vercel one —
 * and the native app calls back over its own scheme. Expo Go's `exp://` is
 * NOT here: the expo plugin adds it itself, and only when NODE_ENV is
 * development, which is the tightening we want.
 */
describe("trustedOrigins", () => {
  it("names the canonical host, the vercel host and the app scheme", () => {
    expect(CANONICAL_ORIGIN).toBe("https://www.faseela24.com");
    expect(trustedOrigins).toEqual([
      "https://www.faseela24.com",
      "https://faseela.vercel.app",
      "faseela://",
    ]);
  });
  it("does not trust exp:// unconditionally", () => {
    expect(trustedOrigins).not.toContain("exp://");
  });
});

/**
 * Better Auth's own limiter keys on IP + path. A per-*email* cap is the second
 * axis: one address cannot be flooded with sign-in mail from many IPs. The
 * decision is pure so the window arithmetic is tested without a database.
 */
describe("sendCapDecision", () => {
  const now = 1_700_000_000_000;
  const rule = { max: 3, windowMs: 60_000 };

  it("covers the two endpoints that send mail", () => {
    expect(EMAIL_SEND_PATHS).toEqual(["/sign-in/magic-link", "/email-otp/send-verification-otp"]);
  });

  it("caps at six sends per address per half hour", () => {
    expect(EMAIL_SEND_CAP).toEqual({ max: 6, windowMs: 30 * 60 * 1000 });
  });

  it("opens a fresh window when there is no record", () => {
    expect(sendCapDecision(null, now, rule)).toEqual({
      allowed: true,
      reset: true,
      count: 1,
      expiresAt: now + 60_000,
    });
  });

  it("counts within an open window", () => {
    expect(sendCapDecision({ count: 1, expiresAt: now + 30_000 }, now, rule)).toEqual({
      allowed: true,
      reset: false,
      count: 2,
      expiresAt: now + 30_000,
    });
  });

  it("refuses once the window is full", () => {
    expect(sendCapDecision({ count: 3, expiresAt: now + 30_000 }, now, rule)).toEqual({
      allowed: false,
      reset: false,
      count: 3,
      expiresAt: now + 30_000,
    });
  });

  it("starts over when the window has expired, even if it was full", () => {
    expect(sendCapDecision({ count: 3, expiresAt: now - 1 }, now, rule)).toEqual({
      allowed: true,
      reset: true,
      count: 1,
      expiresAt: now + 60_000,
    });
  });

  it("treats a corrupt count as a full window rather than an open one", () => {
    expect(sendCapDecision({ count: Number.NaN, expiresAt: now + 30_000 }, now, rule).allowed).toBe(
      false,
    );
  });
});

describe("resolveAuthBaseUrl during `next build`", () => {
  it("does not throw at build time, where no runtime env exists", () => {
    expect(
      resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: undefined, buildPhase: true }),
    ).toBe("https://www.faseela24.com");
  });

  it("keeps a configured value at build time", () => {
    expect(
      resolveAuthBaseUrl({
        nodeEnv: "production",
        betterAuthUrl: "https://faseela.vercel.app",
        buildPhase: true,
      }),
    ).toBe("https://faseela.vercel.app");
  });

  it("still refuses to serve production without it", () => {
    expect(() =>
      resolveAuthBaseUrl({ nodeEnv: "production", betterAuthUrl: undefined, buildPhase: false }),
    ).toThrow(/BETTER_AUTH_URL/);
  });
});

describe("IP_ADDRESS_HEADERS", () => {
  it("reads Vercel's connection-set headers, x-real-ip first", () => {
    expect([...IP_ADDRESS_HEADERS]).toEqual(["x-real-ip", "x-forwarded-for"]);
  });
});
