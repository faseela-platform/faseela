import { describe, expect, it } from "vitest";

import { parseEnvelope, resolveBaseUrl } from "../lib/api";

/**
 * `resolveBaseUrl` is pure so it can run under plain node: the component reads
 * `Constants.expoConfig.hostUri` and `__DEV__` and passes them in. The rules,
 * in precedence order: explicit env URL, then the Metro host in dev, then the
 * production fallback.
 */

const FALLBACK = "https://faseela.vercel.app";

describe("resolveBaseUrl", () => {
  it("returns the env URL when set, ignoring everything else", () => {
    expect(
      resolveBaseUrl({
        envUrl: "https://api.example.com",
        hostUri: "192.168.1.10:8081",
        isDev: true,
        fallback: FALLBACK,
      }),
    ).toBe("https://api.example.com");
  });

  it("strips a trailing slash from the env URL", () => {
    expect(
      resolveBaseUrl({ envUrl: "https://api.example.com/", isDev: false, fallback: FALLBACK }),
    ).toBe("https://api.example.com");
  });

  it("derives http://<metro-host>:3000 from hostUri in dev", () => {
    expect(resolveBaseUrl({ hostUri: "192.168.1.10:8081", isDev: true, fallback: FALLBACK })).toBe(
      "http://192.168.1.10:3000",
    );
  });

  it("handles a hostUri without a port", () => {
    expect(resolveBaseUrl({ hostUri: "192.168.1.10", isDev: true, fallback: FALLBACK })).toBe(
      "http://192.168.1.10:3000",
    );
  });

  it("ignores hostUri outside dev and falls back", () => {
    expect(resolveBaseUrl({ hostUri: "192.168.1.10:8081", isDev: false, fallback: FALLBACK })).toBe(
      FALLBACK,
    );
  });

  it("falls back when dev has no hostUri", () => {
    expect(resolveBaseUrl({ isDev: true, fallback: FALLBACK })).toBe(FALLBACK);
  });

  it("treats an empty env URL as unset", () => {
    expect(
      resolveBaseUrl({ envUrl: "", hostUri: "192.168.1.10:8081", isDev: true, fallback: FALLBACK }),
    ).toBe("http://192.168.1.10:3000");
  });
});

/**
 * `parseEnvelope` narrows the `{data}` / `{error:{code,message}}` wire envelope.
 * Anything that is neither — including non-objects and half-formed errors — maps
 * to `{ ok: false, code: "malformed" }`: the server misbehaving must read as a
 * connection-level failure, never a crash.
 */
describe("parseEnvelope", () => {
  it("unwraps a success envelope", () => {
    expect(parseEnvelope<{ tracks: [] }>({ data: { tracks: [] } })).toEqual({
      ok: true,
      data: { tracks: [] },
    });
  });

  it("surfaces the error code from a failure envelope", () => {
    expect(parseEnvelope({ error: { code: "not_found", message: "المسار غير موجود" } })).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("maps a non-object body to malformed", () => {
    expect(parseEnvelope("<!doctype html>")).toEqual({ ok: false, code: "malformed" });
  });

  it("maps null to malformed", () => {
    expect(parseEnvelope(null)).toEqual({ ok: false, code: "malformed" });
  });

  it("maps an object with neither data nor error to malformed", () => {
    expect(parseEnvelope({ ok: true })).toEqual({ ok: false, code: "malformed" });
  });

  it("maps an error without a string code to malformed", () => {
    expect(parseEnvelope({ error: { message: "boom" } })).toEqual({
      ok: false,
      code: "malformed",
    });
  });

  it("accepts a success envelope whose data is null-ish payload but present", () => {
    expect(parseEnvelope({ data: null })).toEqual({ ok: true, data: null });
  });
});
