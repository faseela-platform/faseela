"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { cancelDraft, isProfileComplete, memberProfile, saveDraft, submitWork } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { objectSize, presignPutUrl, r2IsConfigured, submissionMediaKey } from "@/lib/r2";
import { isOwnSubmissionKey, isWithinUploadCap, submissionExtension } from "@/lib/submission-key";

/**
 * The member side of the review workflow (spec §16–§21), as Server Actions.
 *
 * The reasoning mirrors `attest` in ./actions.ts: the Task id arrives in the form,
 * but the *Member* id is read from the session on the server and never trusted
 * from the client — otherwise one Member could submit into another's name. Every
 * rule (mode, publication, state machine, the attempt log) lives in `@faseela/db`;
 * these functions do authentication, the §5 profile gate, Arabic translation, and
 * cache invalidation, and nothing else.
 */
export type ReviewActionState = {
  status:
    | "submitted"
    | "draft-saved"
    | "cancelled"
    | "unauthenticated"
    | "refused"
    | "profile-incomplete";
  message: string;
  /** Where to complete the account (`profile-incomplete` only) — the panel renders it as a link. */
  href?: string;
};

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** The §5 completion step, returning to the Track afterwards. */
function completeProfileHref(trackSlug: string): string {
  return `/akmil-hisabak?next=${encodeURIComponent(`/masarat/${trackSlug}`)}`;
}

/**
 * The §5 profile gate, shared by every action here. Account creation completes
 * at the first save-requiring interaction — and saving a draft or minting an
 * upload URL is one, exactly as submitting is. Only `submitReviewWork` redirects
 * (the Member pressed a button and expects to go somewhere); the draft autosave
 * and the upload run from a keystroke timer and a file picker, and a redirect
 * from there would yank a Member away mid-sentence and lose the text — those
 * return `profile-incomplete` and the panel shows the step as a link instead.
 */
async function profileIncomplete(userId: string): Promise<boolean> {
  return !isProfileComplete(await memberProfile(db, userId));
}

function profileGateResult(trackSlug: string): ReviewActionState {
  return {
    status: "profile-incomplete",
    message: "أكمل حسابك (الاسم والهاتف) قبل حفظ عملك.",
    href: completeProfileHref(trackSlug),
  };
}

const NOT_OWN_KEY = "الملف المرفق لا يخصّ هذه المهمة. أعد رفعه ثم حاول مجدداً.";

/**
 * Submit work for review, or resubmit after a return. Profile-gated exactly like
 * attest: completing a Task is the §5 "first save-requiring interaction", so a
 * nameless first-time Member is routed to complete their account first (the
 * redirect throws, so nothing below runs).
 */
export async function submitReviewWork(
  taskId: string,
  trackSlug: string,
  input: { body: string; mediaKey: string | null; contentId?: string | null },
): Promise<ReviewActionState> {
  const userId = await currentUserId();
  if (!userId) return { status: "unauthenticated", message: "سجّل دخولك أولاً لإرسال عملك." };

  /** Submitting is a deliberate act — the redirect (which throws) is what the Member expects. */
  if (await profileIncomplete(userId)) redirect(completeProfileHref(trackSlug));

  const body = input.body.trim();
  /** An empty submission is nothing to review — require text or a file. */
  if (body === "" && !input.mediaKey) {
    return { status: "refused", message: "اكتب إجابتك أو أرفق ملفاً قبل الإرسال." };
  }

  /**
   * The key comes back from the browser and is stored as the pointer an Editor
   * will open, so it must be one this server minted for this Member and this
   * Task (submission-key.ts). And since the presigned PUT could not bound the
   * size (r2.ts), the object is measured now: it must exist — the upload
   * actually happened — and fit under the cap.
   */
  if (input.mediaKey !== null) {
    if (!isOwnSubmissionKey(input.mediaKey, taskId, userId)) {
      return { status: "refused", message: NOT_OWN_KEY };
    }
    if (!r2IsConfigured) return { status: "refused", message: "رفع الملفات غير متاح حالياً." };
    const size = await objectSize(input.mediaKey);
    if (size === null) {
      return { status: "refused", message: "لم يكتمل رفع الملف. أعد رفعه ثم حاول مجدداً." };
    }
    if (!isWithinUploadCap(size)) {
      return {
        status: "refused",
        message: "حجم الملف يتجاوز الحدّ المسموح (⁨10⁩ ميغابايت).",
      };
    }
  }

  const result = await submitWork(db, taskId, userId, {
    body: body === "" ? null : body,
    mediaKey: input.mediaKey,
    contentId: input.contentId ?? null,
  });

  switch (result.status) {
    case "invalid-content":
      return { status: "refused", message: "المحتوى المختار غير متاح لهذه المهمة." };
    case "submitted":
      revalidatePath(`/masarat/${trackSlug}`);
      return { status: "submitted", message: "أُرسل عملك، وسيُراجَع قريباً." };
    case "already-pending":
      revalidatePath(`/masarat/${trackSlug}`);
      return { status: "refused", message: "عملك قيد المراجعة، فانتظر نتيجتها." };
    case "already-accepted":
      return { status: "refused", message: "قُبل عملك في هذه المهمة سابقاً." };
    case "rejected":
      return { status: "refused", message: "رُفض عمل هذه المهمة نهائياً." };
    default:
      return { status: "refused", message: "تعذّر الإرسال. حدّث الصفحة وحاول مجدداً." };
  }
}

/**
 * Auto-save the working copy (§21). No revalidation on purpose: a draft save is a
 * background keystroke, not a navigation, and re-rendering the Track on every one
 * would fight the field the Member is typing in.
 */
export async function saveReviewDraft(
  taskId: string,
  trackSlug: string,
  input: { body: string; mediaKey: string | null; contentId?: string | null },
): Promise<ReviewActionState> {
  const userId = await currentUserId();
  if (!userId) return { status: "unauthenticated", message: "سجّل دخولك أولاً." };

  if (await profileIncomplete(userId)) return profileGateResult(trackSlug);

  /** A draft's key is the one that reaches submit; refuse a foreign one here too. */
  if (input.mediaKey !== null && !isOwnSubmissionKey(input.mediaKey, taskId, userId)) {
    return { status: "refused", message: NOT_OWN_KEY };
  }

  const body = input.body.trim();
  const result = await saveDraft(db, taskId, userId, {
    body: body === "" ? null : body,
    mediaKey: input.mediaKey,
    contentId: input.contentId ?? null,
  });
  if (result.status === "invalid-content") {
    return { status: "refused", message: "المحتوى المختار غير متاح لهذه المهمة." };
  }
  return result.status === "saved"
    ? { status: "draft-saved", message: "حُفظت المسودة." }
    : { status: "refused", message: "تعذّر حفظ المسودة." };
}

/** Close a draft the Member decided not to submit (§21). */
export async function cancelReviewDraft(
  taskId: string,
  trackSlug: string,
): Promise<ReviewActionState> {
  const userId = await currentUserId();
  if (!userId) return { status: "unauthenticated", message: "سجّل دخولك أولاً." };

  if (await profileIncomplete(userId)) return profileGateResult(trackSlug);

  const result = await cancelDraft(db, taskId, userId);
  if (result.status === "cancelled") {
    revalidatePath(`/masarat/${trackSlug}`);
    return { status: "cancelled", message: "أُغلقت المسودة." };
  }
  return { status: "refused", message: "لا توجد مسودة لإغلاقها." };
}

export type UploadTicket =
  { ok: true; url: string; key: string } | { ok: false; message: string; href?: string };

/**
 * Mint a presigned PUT URL so the browser can upload a file straight to R2,
 * keeping it off the serverless request path. Returns the object key too — the
 * Member's form holds it and passes it to `submitReviewWork` as `mediaKey`. Auth
 * is required so the key is namespaced to a real Member (§26 history relies on it),
 * and the §5 gate applies: an upload is a save. The extension is checked
 * against the same allow-list submit enforces, so a Member is told now rather
 * than after the upload; the size is checked at submit (see `objectSize`).
 */
export async function requestUploadUrl(
  taskId: string,
  trackSlug: string,
  filename: string,
): Promise<UploadTicket> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "سجّل دخولك أولاً." };

  if (await profileIncomplete(userId)) {
    const gate = profileGateResult(trackSlug);
    return { ok: false, message: gate.message, href: gate.href };
  }

  if (!r2IsConfigured) return { ok: false, message: "رفع الملفات غير متاح حالياً." };
  if (submissionExtension(filename) === null) {
    return {
      ok: false,
      message: "نوع الملف غير مدعوم. أرفق صورة أو ⁨PDF⁩ أو مستنداً أو مقطعاً.",
    };
  }

  const key = submissionMediaKey(taskId, userId, filename);
  const url = await presignPutUrl(key);
  return { ok: true, url, key };
}
