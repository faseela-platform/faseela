import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-path";

/**
 * Open-redirect guard. The value is attacker-controllable (it rides in a query
 * param and, for magic links, ends up in an email the Member is told to trust),
 * so anything that isn't an unambiguous same-site path must collapse to the
 * fallback. These are the shapes that must NOT get through.
 */
describe("safeInternalPath", () => {
  it("returns the fallback when nothing is supplied", () => {
    expect(safeInternalPath(undefined)).toBe("/masarat");
  });
  it("allows a plain same-site path", () => {
    expect(safeInternalPath("/lawha")).toBe("/lawha");
    expect(safeInternalPath("/masarat/reading-groups")).toBe("/masarat/reading-groups");
  });
  it("rejects an absolute URL", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/masarat");
  });
  it("rejects a protocol-relative URL", () => {
    expect(safeInternalPath("//evil.example")).toBe("/masarat");
  });
  it("rejects a backslash-prefixed path some clients normalise to //", () => {
    expect(safeInternalPath("/\\evil.example")).toBe("/masarat");
    expect(safeInternalPath("/\\")).toBe("/masarat");
  });
  it("rejects any path containing a backslash", () => {
    expect(safeInternalPath("/a\\b")).toBe("/masarat");
  });
  it("rejects a value that does not start with a single slash", () => {
    expect(safeInternalPath("lawha")).toBe("/masarat");
  });
  it("honours a caller-supplied fallback", () => {
    expect(safeInternalPath(undefined, "/lawha")).toBe("/lawha");
  });
});
