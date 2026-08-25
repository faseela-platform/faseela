import type { AttestRequest, AttestResponse } from "@faseela/api-types";
import { attestTask, isProfileComplete, memberProfile } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `POST /api/v1/attest` — complete an attest Task from the mobile app.
 *
 * The HTTP mirror of the web `attest` Server Action (`masarat/actions.ts`): the
 * Task id arrives in the body, the Member id is read from the session/token, never
 * the body. The §5 profile gate that the web action satisfies with a `redirect` is
 * returned here as a `profile-incomplete` error the app maps to its completion
 * screen — a route handler cannot redirect a native client. All the real rules
 * (mode, publication, Season, idempotency) stay in `attestTask`.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً لتُحتسب نقاطك.", 401);

  let body: AttestRequest;
  try {
    body = (await req.json()) as AttestRequest;
  } catch {
    return err("validation", "طلب غير صالح.", 400);
  }
  if (!body?.taskId || typeof body.taskId !== "string") {
    return err("validation", "معرّف المهمة مطلوب.", 400);
  }

  /** §5: completing a Task is the first save-requiring interaction; a nameless
   * first-timer must finish their account first. Returned, not redirected. */
  const profile = await memberProfile(db, user.id);
  if (!isProfileComplete(profile)) {
    return err("profile-incomplete", "أكمل حسابك أولاً لتُحتسب نقاطك.", 403);
  }

  const result = await attestTask(db, body.taskId, user.id);
  switch (result.status) {
    case "completed":
    case "already-completed":
      return ok<AttestResponse>({
        taskId: body.taskId,
        status: result.status,
        points: result.points,
      });
    case "no-season":
      return err("conflict", "لا يوجد موسم مفتوح حالياً، ولا تُحتسب النقاط خارج المواسم.", 409);
    default:
      /** not-attestable | not-published — the app offered something it should not have. */
      return err("conflict", "لا يمكن تأكيد هذه المهمة.", 409);
  }
}
