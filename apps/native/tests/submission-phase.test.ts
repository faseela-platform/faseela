import { describe, expect, it } from "vitest";

import { submissionPhase } from "../lib/submission-phase";

/**
 * The one decision the submission screen keeps asking (§21/§22): given the state of
 * my Submission, can I edit and send work right now, and what should the screen
 * call the moment? Pure, so a wrong affordance (an editable pending, a locked
 * returned) is a failing test, not a field bug discovered by a Member.
 */
describe("submissionPhase", () => {
  it("no submission yet, or a cancelled one, is a fresh start — editable, submit says أرسل", () => {
    for (const s of [null, "cancelled"] as const) {
      const p = submissionPhase(s);
      expect(p.canEdit).toBe(true);
      expect(p.statusLabel).toBeNull();
    }
  });

  it("a draft stays editable and is named as the working copy", () => {
    const p = submissionPhase("draft");
    expect(p.canEdit).toBe(true);
    expect(p.statusLabel).toBe("مسودة محفوظة");
  });

  it("pending locks the form — the work is with the reviewer", () => {
    const p = submissionPhase("pending");
    expect(p.canEdit).toBe(false);
    expect(p.statusLabel).toBe("قيد المراجعة");
  });

  it("returned re-opens the form so the Member can improve and resubmit (§23)", () => {
    const p = submissionPhase("returned");
    expect(p.canEdit).toBe(true);
    expect(p.statusLabel).toBe("أُعيد للتحسين");
  });

  it("accepted and rejected are final — locked, each named honestly", () => {
    expect(submissionPhase("accepted")).toEqual({ canEdit: false, statusLabel: "قُبل عملك" });
    expect(submissionPhase("rejected")).toEqual({ canEdit: false, statusLabel: "لم يُقبل" });
  });
});
