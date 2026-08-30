import type { AttestResponse } from "@faseela/api-types";

/**
 * Pure attest logic for the Track screen — importable under plain node (no
 * react-native imports). `TaskItem` reads the wire result and renders from these.
 */

/**
 * A Task reads as done when either source says so. The server's `completedTaskIds`
 * (`/me`) and the Track's Tasks (`/tracks/:slug`) arrive independently, so the
 * server flag can flip from false to true after the item has mounted; a local attest
 * must also survive a server flag that has not caught up yet. Derived every render.
 */
export function isTaskDone(serverDone: boolean, localDone: boolean): boolean {
  return serverDone || localDone;
}

/**
 * Localize an `/attest` error code. The server's human message is dropped by the
 * envelope on purpose, so the distinction between "no open Season" (`no-season`) and
 * "this Task cannot be attested" (`conflict`) arrives as a distinct `code` from
 * `apps/web/app/(site)/api/v1/attest/route.ts`.
 */
export function attestErrorMessage(code: string): string {
  switch (code) {
    case "not_found":
      return "هذه المهمة لم تعد متاحة.";
    case "no-season":
      return "لا يوجد موسم مفتوح الآن.";
    case "conflict":
      return "لا يمكن تأكيد هذه المهمة الآن.";
    case "network":
      return "تعذّر الاتصال. تحقّق من الشبكة وحاول مجدداً.";
    default:
      return "حدث خطأ، حدّث الصفحة وحاول مجدداً.";
  }
}

export type AttestOutcome =
  | { kind: "done" }
  | { kind: "sign-in" }
  | { kind: "complete-profile" }
  | { kind: "error"; message: string };

/**
 * What the screen does with an `/attest` result. Both `completed` and
 * `already-completed` are successes (the route returns the latter as `ok`), and an
 * `already-completed` *code* is mapped the same way defensively — a Task the Member
 * has done is never an error. A missing or stale session routes to sign-in; the §5
 * profile gate routes to the completion screen; everything else is a message.
 */
export function attestOutcome(
  result: { ok: true; data: AttestResponse } | { ok: false; code: string },
): AttestOutcome {
  if (result.ok) return { kind: "done" };
  switch (result.code) {
    case "already-completed":
      return { kind: "done" };
    case "unauthenticated":
      return { kind: "sign-in" };
    case "profile-incomplete":
      return { kind: "complete-profile" };
    default:
      return { kind: "error", message: attestErrorMessage(result.code) };
  }
}
