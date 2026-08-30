import { describe, expect, it } from "vitest";

import { canRender3D, type GateInput } from "./hero-gate";

/** A capable desktop: the one profile that should pass. */
const capable: GateInput = {
  reducedMotion: false,
  saveData: false,
  webgl2: true,
  deviceMemory: 8,
  cores: 8,
  hash: "",
};

describe("the WebGL hero gate (ADR 0028)", () => {
  it("admits a capable desktop", () => {
    expect(canRender3D(capable)).toEqual({ ok: true });
  });

  it("admits an iPhone, which never reports memory or cores", () => {
    expect(canRender3D({ ...capable, deviceMemory: undefined, cores: undefined })).toEqual({
      ok: true,
    });
  });

  it.each([
    ["prefers-reduced-motion", { reducedMotion: true }],
    ["save-data", { saveData: true }],
    ["no-webgl2", { webgl2: false }],
    ["forced-off", { hash: "#noscene" }],
    ["low-memory", { deviceMemory: 2 }],
    ["few-cores", { cores: 6 }],
  ] as const)("declines with reason %s", (reason, override) => {
    expect(canRender3D({ ...capable, ...override })).toEqual({ ok: false, reason });
  });

  it("a 4 GB, 8-core phone is admitted (the floor is ≤2 GB / ≤6 cores, not a mobile ban)", () => {
    expect(canRender3D({ ...capable, deviceMemory: 4, cores: 8 })).toEqual({ ok: true });
  });

  it("a budget octa-core with 3 GB (reported as 2) is declined", () => {
    expect(canRender3D({ ...capable, deviceMemory: 2, cores: 8 })).toEqual({
      ok: false,
      reason: "low-memory",
    });
  });

  it("reduced motion wins over every other fact", () => {
    expect(canRender3D({ ...capable, reducedMotion: true, deviceMemory: 32, cores: 32 })).toEqual({
      ok: false,
      reason: "prefers-reduced-motion",
    });
  });

  it("#webgl forces the scene on, for verification only", () => {
    expect(canRender3D({ ...capable, webgl2: false, cores: 2, hash: "#webgl" })).toEqual({
      ok: true,
    });
  });
});
