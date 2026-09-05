import type { UploadRequest, UploadTicketResponse } from "@faseela/api-types";
import { isProfileComplete, memberProfile } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { presignPutUrl, r2IsConfigured, submissionMediaKey } from "@/lib/r2";
import { submissionExtension } from "@/lib/submission-key";

/**
 * Mint a presigned PUT so the phone uploads a submission file straight to R2 —
 * the HTTP mirror of `requestUploadUrl` (review-actions.ts), same gates in the
 * same order: a real session (the key is namespaced to the Member, §26), the §5
 * profile gate (an upload is a save), R2 actually configured, and the extension
 * allow-list checked now rather than after a wasted upload. The size cannot be
 * bounded here; the submission route measures the object at the gate.
 */
export const dynamic = "force-dynamic";

/** Input-shape validation only (the db seams guard their own ids): the taskId is
 * embedded in the object key, so it must LOOK like a task id before we mint one. */
const TASK_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  let input: UploadRequest;
  try {
    input = (await req.json()) as UploadRequest;
  } catch {
    return err("validation", "جسم الطلب ليس JSON صالحاً.", 400);
  }
  if (typeof input.taskId !== "string" || !TASK_ID_SHAPE.test(input.taskId)) {
    return err("validation", "معرّف المهمة مطلوب.", 400);
  }
  if (typeof input.filename !== "string" || input.filename.trim() === "") {
    return err("validation", "اسم الملف مطلوب.", 400);
  }

  if (!isProfileComplete(await memberProfile(db, user.id))) {
    return err("profile-incomplete", "أكمل حسابك (الاسم والهاتف) قبل رفع الملفات.", 403);
  }

  if (!r2IsConfigured) return err("uploads-unavailable", "رفع الملفات غير متاح حالياً.", 409);
  if (submissionExtension(input.filename) === null) {
    return err(
      "unsupported-type",
      "نوع الملف غير مدعوم. أرفق صورة أو ⁨PDF⁩ أو مستنداً أو مقطعاً.",
      400,
    );
  }

  const key = submissionMediaKey(input.taskId, user.id, input.filename);
  const url = await presignPutUrl(key);
  return ok<UploadTicketResponse>({ url, key });
}
