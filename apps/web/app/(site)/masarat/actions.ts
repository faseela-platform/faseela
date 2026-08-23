"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { attestTask, isProfileComplete, memberProfile } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * The result the button renders. Deliberately a small closed set of Arabic-facing
 * outcomes rather than the raw `AttestResult`, because the page must not have to
 * know which database states exist.
 */
export type AttestActionState = {
  taskId: string;
  status: "completed" | "already-completed" | "unauthenticated" | "refused";
  points?: number;
  message: string;
};

/**
 * Complete an `attest` Task for the signed-in Member.
 *
 * A Server Action rather than a route handler, for one reason that matters: the
 * Task id arrives in the form payload but the *Member* id never does. It is read
 * from the session on the server. If the caller could supply a user id, any
 * Member could mint Points into somebody else's ledger — and on a Leaderboard,
 * awarding points to a rival is as damaging as awarding them to yourself.
 *
 * Everything else is delegated. `attestTask` owns the mode check, the publication
 * check, the Season lookup and idempotency; this function's whole job is
 * authentication, translation into Arabic, and cache invalidation.
 */
export async function attest(taskId: string, trackSlug: string): Promise<AttestActionState> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return {
      taskId,
      status: "unauthenticated",
      message: "سجّل دخولك أولاً لتُحتسب نقاطك.",
    };
  }

  /**
   * Account creation completes here, not at sign-in. Spec §5: creation is
   * triggered by the first save-requiring interaction — completing a Task is
   * exactly that — and requires a name and a phone (the primary contact).
   * Magic-link only captured the email, so a first-time Member reaches this
   * point nameless; send them to complete their account, then back to this Task.
   * The redirect throws, so nothing below runs and no Points are minted early.
   */
  const profile = await memberProfile(db, session.user.id);
  if (!isProfileComplete(profile)) {
    redirect(`/akmil-hisabak?next=${encodeURIComponent(`/masarat/${trackSlug}`)}`);
  }

  const result = await attestTask(db, taskId, session.user.id);

  /**
   * Both success paths revalidate. `already-completed` is not a no-op from the
   * page's point of view: the reason a Member tapped a second time is usually that
   * the first response was lost, and their cached page still shows the Task as
   * incomplete. Skipping the revalidation here would leave them looking at a
   * button that does nothing.
   */
  if (result.status === "completed" || result.status === "already-completed") {
    revalidatePath(`/masarat/${trackSlug}`);
    revalidatePath("/lawha");

    return {
      taskId,
      status: result.status,
      points: result.points,
      message:
        result.status === "completed"
          ? "أُضيفت نقاطك."
          : "أنجزت هذه المهمة سابقاً، ونقاطها محتسبة.",
    };
  }

  /**
   * The remaining three statuses are collapsed into one Arabic message on
   * purpose, but each is given its own sentence, because they need different
   * actions from the reader: a closed Season is a matter of waiting, while the
   * other two mean the page offered something it should not have.
   */
  const message =
    result.status === "no-season"
      ? "لا يوجد موسم مفتوح حالياً، ولا تُحتسب النقاط خارج المواسم."
      : "لا يمكن تأكيد هذه المهمة. حدّث الصفحة وحاول مرة أخرى.";

  return { taskId, status: "refused", message };
}
