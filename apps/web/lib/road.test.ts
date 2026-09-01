import { describe, expect, it } from "vitest";

import { taskStage, walkedSegments } from "./road";

describe("taskStage", () => {
  it("grows an attested Task and tills an unattested one", () => {
    expect(taskStage("attest", true, null)).toBe("grown");
    expect(taskStage("attest", false, null)).toBe("soil");
  });

  it("an attest Task ignores submission state entirely", () => {
    /** Attest Tasks have no submissions; a stray record must not regress the sprout. */
    expect(taskStage("attest", true, "returned")).toBe("grown");
  });

  it("maps the review lifecycle to growth stages", () => {
    expect(taskStage("review", false, null)).toBe("soil");
    expect(taskStage("review", false, "draft")).toBe("seed");
    expect(taskStage("review", false, "pending")).toBe("bud");
    expect(taskStage("review", false, "returned")).toBe("returned");
    expect(taskStage("review", false, "accepted")).toBe("grown");
    expect(taskStage("review", false, "rejected")).toBe("stone");
  });

  it("treats a cancelled draft as a seed — it resumes as a draft", () => {
    expect(taskStage("review", false, "cancelled")).toBe("seed");
  });

  it("tills the soil for an unknown state rather than crashing the road", () => {
    expect(taskStage("review", false, "someday-new-state")).toBe("soil");
  });
});

describe("walkedSegments", () => {
  it("is zero on an untouched road", () => {
    expect(walkedSegments(["soil", "soil", "soil"])).toBe(0);
  });

  it("walks up to and including the furthest grown spot, gates or not", () => {
    /** Task 3 done first: the Member has walked past 1 and 2 to get there. */
    expect(walkedSegments(["soil", "soil", "grown", "soil"])).toBe(3);
  });

  it("intermediate states do not extend the walked earth", () => {
    expect(walkedSegments(["grown", "bud", "seed"])).toBe(1);
  });

  it("walks the whole road when the last spot is grown", () => {
    expect(walkedSegments(["grown", "stone", "grown"])).toBe(3);
  });
});
