"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { cancelDraft, isProfileComplete, memberProfile, saveDraft, submitWork } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignPutUrl, r2IsConfigured, submissionMediaKey } from "@/lib/r2";

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
  status: "submitted" | "draft-saved" | "cancelled" | "unauthenticated" | "refused";
  message: string;
};

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/**
 * Submit work for review, or resubmit after a return. Profile-gated exactly like
 * attest: completing a Task is the §5 "first save-requiring interaction", so a
 * nameless first-time Member is routed to complete their account first (the
 * redirect throws, so nothing below runs).
 */
export async function submitReviewWork(
  taskId: string,
  trackSlug: string,
  input: { body: string; mediaKey: string | null },
): Promise<ReviewActionState> {
  const userId = await currentUserId();
  if (!userId) return { status: "unauthenticated", message: "سجّل دخولك أولاً لإرسال عملك." };

  const profile = await memberProfile(db, userId);
  if (!isProfileComplete(profile)) {
    redirect(`/akmil-hisabak?next=${encodeURIComponent(`/masarat/${trackSlug}`)}`);
  }

  const body = input.body.trim();
  /** An empty submission is nothing to review — require text or a file. */
  if (body === "" && !input.mediaKey) {
    return { status: "refused", message: "اكتب إجابتك أو أرفق ملفاً قبل الإرسال." };
  }

  const result = await submitWork(db, taskId, userId, {
    body: body === "" ? null : body,
    mediaKey: input.mediaKey,
  });

  switch (result.status) {
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
  input: { body: string; mediaKey: string | null },
): Promise<ReviewActionState> {
  const userId = await currentUserId();
  if (!userId) return { status: "unauthenticated", message: "سجّل دخولك أولاً." };

  const body = input.body.trim();
  const result = await saveDraft(db, taskId, userId, {
    body: body === "" ? null : body,
    mediaKey: input.mediaKey,
  });
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

  const result = await cancelDraft(db, taskId, userId);
  if (result.status === "cancelled") {
    revalidatePath(`/masarat/${trackSlug}`);
    return { status: "cancelled", message: "أُغلقت المسودة." };
  }
  return { status: "refused", message: "لا توجد مسودة لإغلاقها." };
}

export type UploadTicket = { ok: true; url: string; key: string } | { ok: false; message: string };

/**
 * Mint a presigned PUT URL so the browser can upload a file straight to R2,
 * keeping it off the serverless request path. Returns the object key too — the
 * Member's form holds it and passes it to `submitReviewWork` as `mediaKey`. Auth
 * is required so the key is namespaced to a real Member (§26 history relies on it).
 */
export async function requestUploadUrl(taskId: string, filename: string): Promise<UploadTicket> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "سجّل دخولك أولاً." };
  if (!r2IsConfigured) return { ok: false, message: "رفع الملفات غير متاح حالياً." };

  const key = submissionMediaKey(taskId, userId, filename);
  const url = await presignPutUrl(key);
  return { ok: true, url, key };
}
