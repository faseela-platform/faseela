import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-path";

/**
 * Open-redirect guard. The value is attacker-controllable (it rides in a query
 * param and, for magic links, ends up in an email the Member is told to trust),
 * so anything that isn't an unambiguous same-site path must collapse to the
 * fallback. These are the shapes that must NOT get through.
 */
describe("safeInternalPath", () => {
  it("falls back to the personalised home (/mustajaddat) when nothing is supplied", () => {
    expect(safeInternalPath(undefined)).toBe("/mustajaddat");
  });
  it("allows a plain same-site path", () => {
    expect(safeInternalPath("/lawha")).toBe("/lawha");
    expect(safeInternalPath("/masarat/reading-groups")).toBe("/masarat/reading-groups");
  });
  it("rejects an absolute URL", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/mustajaddat");
  });
  it("rejects a protocol-relative URL", () => {
    expect(safeInternalPath("//evil.example")).toBe("/mustajaddat");
  });
  it("rejects a backslash-prefixed path some clients normalise to //", () => {
    expect(safeInternalPath("/\\evil.example")).toBe("/mustajaddat");
    expect(safeInternalPath("/\\")).toBe("/mustajaddat");
  });
  it("rejects any path containing a backslash", () => {
    expect(safeInternalPath("/a\\b")).toBe("/mustajaddat");
  });
  it("rejects a value that does not start with a single slash", () => {
    expect(safeInternalPath("lawha")).toBe("/mustajaddat");
  });
  it("honours a caller-supplied fallback", () => {
    expect(safeInternalPath(undefined, "/lawha")).toBe("/lawha");
  });
});
