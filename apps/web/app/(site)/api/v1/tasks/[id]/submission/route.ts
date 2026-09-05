import type {
  SubmitSubmissionRequest,
  SubmitSubmissionResponse,
  TaskSubmissionResponse,
} from "@faseela/api-types";
import { toApiMySubmission } from "@faseela/api-types";
import {
  isProfileComplete,
  memberProfile,
  memberSubmissions,
  saveDraft,
  submitWork,
  taskContentChoices,
} from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { objectSize, r2IsConfigured } from "@/lib/r2";
import { isOwnSubmissionKey, isWithinUploadCap } from "@/lib/submission-key";

/**
 * The member side of the review workflow (§16–§26) over HTTP — the mobile mirror
 * of `masarat/review-actions.ts`, guard for guard. The Member id comes from the
 * bearer token, never the body; the §5 profile gate returns `profile-incomplete`
 * as a status (a phone cannot be redirected); and the mediaKey checks are the
 * same three the web action runs: minted-for-this-Member-and-Task, R2 actually
 * configured, and the object present and under the cap.
 *
 * GET returns the Member's current Submission (or null) plus the §19 content
 * choices, which is everything the phone's panel needs in one request.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  const { id: taskId } = await params;
  /** A malformed id is absence, not a throw — the db seams guard it themselves. */
  const [mine] = await memberSubmissions(db, user.id, [taskId]);
  const choices = await taskContentChoices(db, taskId);
  return ok<TaskSubmissionResponse>({
    submission: mine ? toApiMySubmission(mine) : null,
    choices: choices.map((c) => ({ id: c.id, title: c.title })),
  });
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً لإرسال عملك.", 401);

  const { id: taskId } = await params;

  let input: SubmitSubmissionRequest;
  try {
    input = (await req.json()) as SubmitSubmissionRequest;
  } catch {
    return err("validation", "جسم الطلب ليس JSON صالحاً.", 400);
  }
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const mediaKey = typeof input.mediaKey === "string" ? input.mediaKey : null;
  const contentId = typeof input.contentId === "string" ? input.contentId : null;
  const draft = input.draft === true;

  if (!isProfileComplete(await memberProfile(db, user.id))) {
    return err("profile-incomplete", "أكمل حسابك (الاسم والهاتف) قبل حفظ عملك.", 403);
  }

  /** An empty submission is nothing to review; an empty draft is fine (§21). */
  if (!draft && body === "" && !mediaKey) {
    return err("validation", "اكتب إجابتك أو أرفق ملفاً قبل الإرسال.", 400);
  }

  if (mediaKey !== null) {
    if (!isOwnSubmissionKey(mediaKey, taskId, user.id)) {
      return err("validation", "الملف المرفق لا يخصّ هذه المهمة. أعد رفعه ثم حاول مجدداً.", 400);
    }
    /** The presigned PUT could not bound the size — measure at the gate (submit only;
     * a draft holds the key without judging it, exactly like the web action). */
    if (!draft) {
      if (!r2IsConfigured) return err("uploads-unavailable", "رفع الملفات غير متاح حالياً.", 409);
      const size = await objectSize(mediaKey);
      if (size === null) {
        return err("validation", "لم يكتمل رفع الملف. أعد رفعه ثم حاول مجدداً.", 400);
      }
      if (!isWithinUploadCap(size)) {
        return err("validation", "حجم الملف يتجاوز الحدّ المسموح (⁨10⁩ ميغابايت).", 400);
      }
    }
  }

  const payload = { body: body === "" ? null : body, mediaKey, contentId };
  const result = draft
    ? await saveDraft(db, taskId, user.id, payload)
    : await submitWork(db, taskId, user.id, payload);

  switch (result.status) {
    case "submitted":
      return ok<SubmitSubmissionResponse>({ state: "submitted" });
    case "saved":
      return ok<SubmitSubmissionResponse>({ state: "draft-saved" });
    case "invalid-content":
      return err("invalid-content", "المحتوى المختار غير متاح لهذه المهمة.", 409);
    case "not-found":
      return err("not_found", "لا توجد هذه المهمة.", 404);
    case "already-pending":
      return err("conflict", "عملك قيد المراجعة، فانتظر نتيجتها.", 409);
    case "already-accepted":
      return err("conflict", "قُبل عملك في هذه المهمة سابقاً.", 409);
    case "rejected":
      return err("conflict", "رُفض عمل هذه المهمة نهائياً.", 409);
    default:
      return err("conflict", "تعذّر الحفظ. حدّث الشاشة وحاول مجدداً.", 409);
  }
}
