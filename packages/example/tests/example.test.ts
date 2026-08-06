import { describe, expect, it } from "vitest";

// Imports the entry point, never ../lib/format — tests go through the public
// surface like any other consumer. See ../../README.md.
import { pointTotal } from "../index.js";

describe("pointTotal", () => {
  it("wraps digits in a bidi isolate so they do not jump inside Arabic text", () => {
    const result = pointTotal(50);
    expect(result.startsWith("\u2068")).toBe(true);
    expect(result.endsWith("\u2069")).toBe(true);
  });

  it("formats using Lebanese Arabic conventions", () => {
    expect(pointTotal(1234)).toContain(new Intl.NumberFormat("ar-LB").format(1234));
  });
});
