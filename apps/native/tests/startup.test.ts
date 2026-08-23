import { describe, expect, it } from "vitest";

import { shouldHideSplash } from "../lib/startup";

/**
 * The splash must come down when fonts finish — OR when they fail. Holding the
 * splash on a font error turns one lost request into an app that never opens
 * (observed over a flaky tunnel: a dropped font download left the splash up
 * forever). Failing to load Cairo means system Arabic fonts, not no app.
 */
describe("shouldHideSplash", () => {
  it("keeps the splash while fonts are still loading", () => {
    expect(shouldHideSplash(false, null)).toBe(false);
  });

  it("hides the splash when fonts have loaded", () => {
    expect(shouldHideSplash(true, null)).toBe(true);
  });

  it("hides the splash when font loading failed, so the app still opens", () => {
    expect(shouldHideSplash(false, new Error("download failed"))).toBe(true);
  });

  it("hides the splash when fonts loaded despite a reported error", () => {
    expect(shouldHideSplash(true, new Error("partial"))).toBe(true);
  });
});
