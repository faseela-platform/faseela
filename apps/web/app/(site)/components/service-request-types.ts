import type { ServiceRequestStatus, ServiceRequestType } from "@faseela/db";

/**
 * The Arabic vocabulary of a Service Request (§37). Shared: the kinds are shown on
 * the public contact form *and* in the admin triage list, so they live with the
 * shared components rather than under `/idara` — one place to retitle a kind, and no
 * server page importing a label map out of a client module.
 */
export const KIND_LABEL: Record<ServiceRequestType, string> = {
  suggestion: "اقتراح",
  inquiry: "استفسار",
  note: "ملاحظة",
  app_issue: "أمر يتعلق بالتطبيق",
};

/** The order the kinds are offered in — §37's own order. */
export const KINDS = Object.keys(KIND_LABEL) as ServiceRequestType[];

/** Triage states. Admin-facing only, but kept beside the kinds they describe. */
export const STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  new: "جديدة",
  in_progress: "قيد المعالجة",
  handled: "عولجت",
  archived: "مؤرشفة",
};

export const STATUSES = Object.keys(STATUS_LABEL) as ServiceRequestStatus[];
