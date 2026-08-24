"use server";

import { revalidatePath } from "next/cache";

import { acceptSubmission, rejectSubmission, returnSubmission } from "@faseela/db";

import { db } from "@/lib/db";
import { requireEditor } from "@/lib/require-editor";

/**
 * The Editor's three verdicts (spec §25), as Server Actions.
 *
 * Every one re-checks authority with `requireEditor` on the server — the id of the
 * reviewing Editor comes from the session, never the form, so nobody can accept
 * work in another Editor's name any more than a Member can submit in another's.
 * The rules (pending-only, graded value ≤ max, the frozen mint, the attempt stamp)
 * all live in `@faseela/db`; this layer authenticates, translates, and revalidates.
 */
export type DecisionState = {
  status: "accepted" | "returned" | "rejected" | "refused";
  message: string;
};

function revalidate(submissionId: string) {
  revalidatePath("/muraja3a");
  revalidatePath(`/muraja3a/${submissionId}`);
  /** Accepting mints Points, which reorders the Leaderboard. */
  revalidatePath("/lawha");
}

export async function acceptReview(submissionId: string, points: number): Promise<DecisionState> {
  const editor = await requireEditor();
  const result = await acceptSubmission(db, submissionId, editor.id, points);
  revalidate(submissionId);

  switch (result.status) {
    case "accepted":
      return { status: "accepted", message: `قُبل العمل، واحتُسبت ${result.points} نقطة.` };
    case "invalid-points":
      return { status: "refused", message: "النقاط يجب أن تكون بين ١ والحدّ الأقصى للمهمة." };
    case "not-pending":
      return { status: "refused", message: "لم تعد هذه المشاركة بانتظار المراجعة." };
    case "no-season":
      return { status: "refused", message: "لا يوجد موسم مفتوح لاحتساب النقاط." };
    default:
      return { status: "refused", message: "تعذّر القبول. حدّث الصفحة وحاول مجدداً." };
  }
}

export async function returnReview(submissionId: string, note: string): Promise<DecisionState> {
  const editor = await requireEditor();
  const result = await returnSubmission(db, submissionId, editor.id, note);
  revalidate(submissionId);

  switch (result.status) {
    case "returned":
      return { status: "returned", message: "أُعيد العمل للعضو مع ملاحظتك." };
    case "note-required":
      return { status: "refused", message: "اكتب ملاحظة توضّح المطلوب قبل الإعادة." };
    case "not-pending":
      return { status: "refused", message: "لم تعد هذه المشاركة بانتظار المراجعة." };
    default:
      return { status: "refused", message: "تعذّرت الإعادة. حدّث الصفحة وحاول مجدداً." };
  }
}

export async function rejectReview(submissionId: string, note: string): Promise<DecisionState> {
  const editor = await requireEditor();
  const result = await rejectSubmission(db, submissionId, editor.id, note);
  revalidate(submissionId);

  switch (result.status) {
    case "rejected":
      return { status: "rejected", message: "رُفض العمل نهائياً، وأُبلغ العضو بالسبب." };
    case "note-required":
      return { status: "refused", message: "اكتب سبب الرفض قبل تأكيده." };
    case "not-pending":
      return { status: "refused", message: "لم تعد هذه المشاركة بانتظار المراجعة." };
    default:
      return { status: "refused", message: "تعذّر الرفض. حدّث الصفحة وحاول مجدداً." };
  }
}
