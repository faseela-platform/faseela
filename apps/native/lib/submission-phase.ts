import type { ApiMySubmission } from "@faseela/api-types";

/**
 * What the Member may do with their Submission right now (§21/§22): the working
 * copy (none yet, a draft, or a return) is editable; work with the reviewer or
 * finally judged is locked. `statusLabel` is the moment's name above the form —
 * null when there is nothing to report (a fresh start).
 */
export type SubmissionPhase = {
  canEdit: boolean;
  statusLabel: string | null;
};

export function submissionPhase(state: ApiMySubmission["state"] | null): SubmissionPhase {
  switch (state) {
    case null:
    case "cancelled":
      return { canEdit: true, statusLabel: null };
    case "draft":
      return { canEdit: true, statusLabel: "مسودة محفوظة" };
    case "returned":
      return { canEdit: true, statusLabel: "أُعيد للتحسين" };
    case "pending":
      return { canEdit: false, statusLabel: "قيد المراجعة" };
    case "accepted":
      return { canEdit: false, statusLabel: "قُبل عملك" };
    case "rejected":
      return { canEdit: false, statusLabel: "لم يُقبل" };
  }
}
