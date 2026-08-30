import { describe, expect, it } from "vitest";

import { attestErrorMessage, attestOutcome, isTaskDone } from "../lib/attest";

/**
 * The Track screen mounts a TaskItem as soon as `/tracks/:slug` resolves, while the
 * Member's `completedTaskIds` from `/me` may still be in flight. The rendered state
 * must therefore be derived from both sources on every render, never seeded once.
 */
describe("isTaskDone", () => {
  it("is not done when neither the server nor a local attest says so", () => {
    expect(isTaskDone(false, false)).toBe(false);
  });

  it("shows done when the server's completed list arrives after mount", () => {
    expect(isTaskDone(true, false)).toBe(true);
  });

  it("keeps a just-attested Task done even while the server still says not done", () => {
    expect(isTaskDone(false, true)).toBe(true);
  });

  it("is done when both agree", () => {
    expect(isTaskDone(true, true)).toBe(true);
  });
});

describe("attestErrorMessage", () => {
  it("names the missing season", () => {
    expect(attestErrorMessage("no-season")).toBe("لا يوجد موسم مفتوح الآن.");
  });

  it("names a Task that no longer exists (a stale link), not a generic error", () => {
    expect(attestErrorMessage("not_found")).toBe("هذه المهمة لم تعد متاحة.");
  });

  it("keeps the generic conflict copy for a Task that cannot be attested", () => {
    expect(attestErrorMessage("conflict")).toBe("لا يمكن تأكيد هذه المهمة الآن.");
  });

  it("tells the Member to check the network on a transport failure", () => {
    expect(attestErrorMessage("network")).toBe("تعذّر الاتصال. تحقّق من الشبكة وحاول مجدداً.");
  });

  it("falls back to the refresh copy for anything unknown", () => {
    expect(attestErrorMessage("malformed")).toBe("حدث خطأ، حدّث الصفحة وحاول مجدداً.");
  });
});

describe("attestOutcome", () => {
  const ok = (status: "completed" | "already-completed") =>
    ({ ok: true, data: { taskId: "t1", status, points: 10 } }) as const;

  it("marks a fresh completion as done", () => {
    expect(attestOutcome(ok("completed"))).toEqual({ kind: "done" });
  });

  it("marks an already-completed Task as done rather than as an error", () => {
    expect(attestOutcome(ok("already-completed"))).toEqual({ kind: "done" });
  });

  it("treats an already-completed error code as done too", () => {
    expect(attestOutcome({ ok: false, code: "already-completed" })).toEqual({ kind: "done" });
  });

  it("routes a stale or missing session to sign-in", () => {
    expect(attestOutcome({ ok: false, code: "unauthenticated" })).toEqual({ kind: "sign-in" });
  });

  it("routes the §5 profile gate to the completion screen", () => {
    expect(attestOutcome({ ok: false, code: "profile-incomplete" })).toEqual({
      kind: "complete-profile",
    });
  });

  it("surfaces every other code as a localized message", () => {
    expect(attestOutcome({ ok: false, code: "no-season" })).toEqual({
      kind: "error",
      message: "لا يوجد موسم مفتوح الآن.",
    });
    expect(attestOutcome({ ok: false, code: "conflict" })).toEqual({
      kind: "error",
      message: "لا يمكن تأكيد هذه المهمة الآن.",
    });
  });
});
