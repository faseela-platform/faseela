import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Database, Queryable } from "./client";
import { submission, submissionAttempt, task } from "./content";
import { user } from "./identity";
import { isStaffRole } from "./members";
import { pointAward } from "./progress";
import { currentSeason } from "./seasons";

/**
 * The `review` completion path (spec §16–§26).
 *
 * Where `attest` mints Points on the Member's own declaration, `review` waits for
 * a human: a Member submits work, an Editor accepts (minting a *graded* value),
 * returns it for revision, or rejects it. The lifecycle lives on the single
 * `submission` row (one per Member per Task); every submit is copied, frozen, into
 * an immutable `submission_attempt` row so a resubmission after a return never
 * erases what was reviewed before (§26), and an Editor always sees the history
 * (§24).
 *
 * These functions are the only sanctioned way to move a Submission through that
 * lifecycle. They live behind the package boundary for the same reason
 * `attestTask` does: the moment the mint can be assembled at a call site, the
 * "Points come only from an accepted Submission" guarantee becomes advisory.
 */

/** What a Member sends in: text, an optional file, or both (the simple v1 shape). */
export type SubmissionInput = { body?: string | null; mediaKey?: string | null };

export type SubmitResult =
  | { status: "submitted"; submissionId: string; attemptNo: number }
  | { status: "not-reviewable" }
  | { status: "not-published" }
  | { status: "already-pending" }
  | { status: "already-accepted" }
  | { status: "rejected" };

/**
 * Submit work for review, or resubmit after a return.
 *
 * Allowed from nothing, a draft, a returned Submission, or a cancelled one — every
 * state where the Member legitimately holds the ball. Refused while the work is
 * `pending` (an Editor has it), already `accepted` (done), or terminally
 * `rejected` (§25). Each accepted call appends one attempt; the guard is what stops
 * a second attempt appearing behind an Editor's back mid-review.
 */
export async function submitWork(
  db: Database,
  taskId: string,
  userId: string,
  input: SubmissionInput,
  at: Date = new Date(),
): Promise<SubmitResult> {
  const body = input.body ?? null;
  const mediaKey = input.mediaKey ?? null;

  return db.transaction(async (tx) => {
    const taskError = await reviewableTaskError(tx, taskId);
    if (taskError) return { status: taskError };

    const [existing] = await tx
      .select({ id: submission.id, state: submission.state })
      .from(submission)
      .where(and(eq(submission.taskId, taskId), eq(submission.userId, userId)))
      .limit(1);

    let submissionId: string;
    if (existing) {
      if (existing.state === "pending") return { status: "already-pending" };
      if (existing.state === "accepted") return { status: "already-accepted" };
      if (existing.state === "rejected") return { status: "rejected" };

      /**
       * `draft`, `returned` and `cancelled` all fall through to a fresh attempt.
       * A cancelled draft is deliberately resumable: one Submission row exists per
       * (Task, Member), so if cancelling were terminal a Member who closed a draft
       * could never submit that Task again. Reopening the row is the only way to
       * let them, and it is what a Member coming back to the Task expects.
       */

      /**
       * Promote the held Submission (draft / returned / cancelled) back to pending.
       * The reviewer columns are cleared together — the `submission_reviewed_together`
       * CHECK requires `reviewed_by` and `reviewed_at` to be null or set as a pair —
       * because a fresh attempt has not been reviewed by anyone yet.
       */
      await tx
        .update(submission)
        .set({
          state: "pending",
          body,
          mediaKey,
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: at,
        })
        .where(eq(submission.id, existing.id));
      submissionId = existing.id;
    } else {
      const [inserted] = await tx
        .insert(submission)
        .values({ taskId, userId, body, mediaKey, state: "pending", createdAt: at, updatedAt: at })
        .returning({ id: submission.id });
      submissionId = inserted!.id;
    }

    const attemptNo = await nextAttemptNo(tx, submissionId);
    await tx.insert(submissionAttempt).values({
      submissionId,
      attemptNo,
      body,
      mediaKey,
      submittedAt: at,
    });

    return { status: "submitted", submissionId, attemptNo };
  });
}

export type SaveDraftResult =
  | { status: "saved"; submissionId: string }
  | { status: "not-reviewable" }
  | { status: "not-published" }
  | { status: "locked" };

/**
 * Auto-save a draft (§21). Writes only the working copy on the `submission` row;
 * it never touches the attempt log, because a draft is not a submission — nothing
 * to review has happened yet. Allowed while composing (`draft`) or revising a
 * returned Submission; refused once the work is pending, decided, or cancelled.
 */
export async function saveDraft(
  db: Database,
  taskId: string,
  userId: string,
  input: SubmissionInput,
  at: Date = new Date(),
): Promise<SaveDraftResult> {
  const body = input.body ?? null;
  const mediaKey = input.mediaKey ?? null;

  return db.transaction(async (tx) => {
    const taskError = await reviewableTaskError(tx, taskId);
    if (taskError) return { status: taskError };

    const [existing] = await tx
      .select({ id: submission.id, state: submission.state })
      .from(submission)
      .where(and(eq(submission.taskId, taskId), eq(submission.userId, userId)))
      .limit(1);

    if (existing) {
      if (existing.state !== "draft" && existing.state !== "returned") {
        return { status: "locked" };
      }
      /** Leave the state as-is (a returned Submission stays returned, keeping its
       * note) and just update the working copy. */
      await tx
        .update(submission)
        .set({ body, mediaKey, updatedAt: at })
        .where(eq(submission.id, existing.id));
      return { status: "saved", submissionId: existing.id };
    }

    const [inserted] = await tx
      .insert(submission)
      .values({ taskId, userId, body, mediaKey, state: "draft", createdAt: at, updatedAt: at })
      .returning({ id: submission.id });
    return { status: "saved", submissionId: inserted!.id };
  });
}

export type CancelDraftResult = { status: "cancelled" } | { status: "not-a-draft" };

/**
 * Close a draft the Member decided not to submit (§21). A cancellation is not a
 * rejection — it carries no Editor and no note — so it only applies to a `draft`.
 */
export async function cancelDraft(
  db: Database,
  taskId: string,
  userId: string,
  at: Date = new Date(),
): Promise<CancelDraftResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: submission.id, state: submission.state })
      .from(submission)
      .where(and(eq(submission.taskId, taskId), eq(submission.userId, userId)))
      .limit(1);

    if (!existing || existing.state !== "draft") return { status: "not-a-draft" };

    await tx
      .update(submission)
      .set({ state: "cancelled", updatedAt: at })
      .where(eq(submission.id, existing.id));
    return { status: "cancelled" };
  });
}

export type AcceptResult =
  | { status: "accepted"; awardId: string; points: number; attemptNo: number }
  | { status: "not-pending" }
  | { status: "invalid-points" }
  | { status: "not-an-editor" }
  | { status: "no-season" };

/**
 * Accept a pending Submission and mint its Points (§25).
 *
 * The Editor sets `earnedPoints` — the *graded* value, which may be anywhere from
 * 1 up to the Task's maximum. "Frozen" (ADR 0015) means a later edit to
 * `task.points` cannot move an award already minted; it does not mean the award
 * equals the maximum. So the graded value is what is written to the ledger and
 * what is frozen there.
 *
 * Guards, in order: the reviewer must be staff (a Member can never accept work,
 * their own least of all); the Submission must be pending; the value must be within
 * the Task's range; and there must be an open Season to count toward. The whole
 * thing is one transaction, so a failure at the mint leaves the review un-stamped
 * rather than half-done.
 */
export async function acceptSubmission(
  db: Database,
  submissionId: string,
  editorId: string,
  earnedPoints: number,
  at: Date = new Date(),
): Promise<AcceptResult> {
  return db.transaction(async (tx) => {
    if (!(await isStaff(tx, editorId))) return { status: "not-an-editor" };

    const [row] = await tx
      .select({
        state: submission.state,
        userId: submission.userId,
        taskId: submission.taskId,
        maxPoints: task.points,
      })
      .from(submission)
      .innerJoin(task, eq(task.id, submission.taskId))
      .where(eq(submission.id, submissionId))
      .limit(1);
    if (!row) throw new Error(`No submission ${submissionId}`);
    if (row.state !== "pending") return { status: "not-pending" };

    if (!Number.isInteger(earnedPoints) || earnedPoints < 1 || earnedPoints > row.maxPoints) {
      return { status: "invalid-points" };
    }

    const season = await currentSeason(tx, at);
    if (!season) return { status: "no-season" };

    const attempt = await stampCurrentAttempt(tx, submissionId, {
      decision: "accepted",
      earnedPoints,
      reviewNote: null,
      reviewedBy: editorId,
      reviewedAt: at,
    });

    await tx
      .update(submission)
      .set({ state: "accepted", reviewedBy: editorId, reviewedAt: at, updatedAt: at })
      .where(eq(submission.id, submissionId));

    const inserted = await tx
      .insert(pointAward)
      .values({
        userId: row.userId,
        seasonId: season.id,
        taskId: row.taskId,
        submissionId,
        /** The graded value, frozen here — never re-read through the Task. */
        points: earnedPoints,
        awardedAt: at,
      })
      .onConflictDoNothing({ target: pointAward.submissionId })
      .returning({ id: pointAward.id, points: pointAward.points });

    if (inserted[0]) {
      return {
        status: "accepted",
        awardId: inserted[0].id,
        points: inserted[0].points,
        attemptNo: attempt.attemptNo,
      };
    }

    /**
     * The insert hit `point_award_submission_unique`. A *sequential* second accept
     * never reaches here — the `not-pending` guard above already turned it away. This
     * fires only when two accepts race: both pass the pending check, one inserts, the
     * other conflicts. Return the winner's award so the loser still resolves cleanly.
     */
    const [existing] = await tx
      .select({ id: pointAward.id, points: pointAward.points })
      .from(pointAward)
      .where(eq(pointAward.submissionId, submissionId))
      .limit(1);
    return {
      status: "accepted",
      awardId: existing!.id,
      points: existing!.points,
      attemptNo: attempt.attemptNo,
    };
  });
}

export type ReturnResult =
  | { status: "returned"; attemptNo: number }
  | { status: "not-pending" }
  | { status: "not-an-editor" }
  | { status: "note-required" };

/**
 * Return a pending Submission for revision (§24). Carries a note, because a return
 * the Member cannot act on is indistinguishable from silence — the note is the
 * whole difference between "try again, here is how" and a dead end. The Member may
 * then resubmit via `submitWork`, which appends a new attempt without disturbing
 * this one.
 */
export async function returnSubmission(
  db: Database,
  submissionId: string,
  editorId: string,
  note: string,
  at: Date = new Date(),
): Promise<ReturnResult> {
  const outcome = await recordNoteVerdict(db, submissionId, editorId, note, "returned", at);
  return outcome.ok
    ? { status: "returned", attemptNo: outcome.attemptNo }
    : { status: outcome.status };
}

export type RejectResult =
  | { status: "rejected"; attemptNo: number }
  | { status: "not-pending" }
  | { status: "not-an-editor" }
  | { status: "note-required" };

/**
 * Reject a pending Submission for good (§25) — terminal, so no resubmission
 * follows. Also carries a note: the Member is owed the reason their work did not
 * count, both as courtesy and so the decision is auditable later.
 */
export async function rejectSubmission(
  db: Database,
  submissionId: string,
  editorId: string,
  note: string,
  at: Date = new Date(),
): Promise<RejectResult> {
  const outcome = await recordNoteVerdict(db, submissionId, editorId, note, "rejected", at);
  return outcome.ok
    ? { status: "rejected", attemptNo: outcome.attemptNo }
    : { status: outcome.status };
}

/**
 * The shared body of return and reject: a note-carrying verdict stamped on the
 * pending attempt, moving the Submission to a state named by the decision —
 * `returned` (revisable) or `rejected` (terminal). The two differ in that one word
 * alone; the `submission_state` enum carries both names, so the decision literal
 * doubles as the new state.
 */
async function recordNoteVerdict(
  db: Database,
  submissionId: string,
  editorId: string,
  note: string,
  decision: "returned" | "rejected",
  at: Date,
): Promise<
  | { ok: true; attemptNo: number }
  | { ok: false; status: "not-pending" | "not-an-editor" | "note-required" }
> {
  const trimmed = note.trim();
  return db.transaction(async (tx) => {
    if (!(await isStaff(tx, editorId))) return { ok: false, status: "not-an-editor" };
    if (trimmed === "") return { ok: false, status: "note-required" };

    const [row] = await tx
      .select({ state: submission.state })
      .from(submission)
      .where(eq(submission.id, submissionId))
      .limit(1);
    if (!row) throw new Error(`No submission ${submissionId}`);
    if (row.state !== "pending") return { ok: false, status: "not-pending" };

    const attempt = await stampCurrentAttempt(tx, submissionId, {
      decision,
      earnedPoints: null,
      reviewNote: trimmed,
      reviewedBy: editorId,
      reviewedAt: at,
    });

    await tx
      .update(submission)
      .set({
        state: decision,
        reviewNote: trimmed,
        reviewedBy: editorId,
        reviewedAt: at,
        updatedAt: at,
      })
      .where(eq(submission.id, submissionId));

    return { ok: true, attemptNo: attempt.attemptNo };
  });
}

export type ReviewQueueItem = {
  submissionId: string;
  taskId: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  submittedAt: Date;
  attemptCount: number;
};

/**
 * The Editor's queue: everything waiting for review, oldest first. Ordered by when
 * the Submission first arrived so nothing waits forever behind newer work. Joined
 * to the Task and Member so the queue reads as a list of people and work rather
 * than a list of ids.
 */
export async function reviewQueue(db: Database): Promise<ReviewQueueItem[]> {
  const rows = await db
    .select({
      submissionId: submission.id,
      taskId: submission.taskId,
      taskTitle: task.title,
      memberId: submission.userId,
      memberName: user.name,
      submittedAt: submission.createdAt,
      attemptCount: sql<number>`(
        select count(*) from ${submissionAttempt}
        where ${submissionAttempt.submissionId} = ${submission.id}
      )`,
    })
    .from(submission)
    .innerJoin(task, eq(task.id, submission.taskId))
    .innerJoin(user, eq(user.id, submission.userId))
    .where(eq(submission.state, "pending"))
    .orderBy(asc(submission.createdAt));

  return rows.map((r) => ({ ...r, attemptCount: Number(r.attemptCount) }));
}

export type ReviewAttempt = {
  attemptNo: number;
  body: string | null;
  mediaKey: string | null;
  submittedAt: Date;
  decision: "accepted" | "returned" | "rejected" | null;
  reviewNote: string | null;
  earnedPoints: number | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

export type SubmissionDetail = {
  submissionId: string;
  state: "pending" | "accepted" | "rejected" | "returned" | "draft" | "cancelled";
  taskId: string;
  taskTitle: string;
  taskInstructions: string;
  taskPoints: number;
  memberId: string;
  memberName: string;
  attempts: ReviewAttempt[];
};

/**
 * One Submission with everything an Editor needs to judge it: the Task it answers,
 * who submitted it, and — the point of §24 — every previous attempt and every
 * previous note, in order, so the current try is read in the light of the last.
 */
export async function submissionForReview(
  db: Database,
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const [head] = await db
    .select({
      submissionId: submission.id,
      state: submission.state,
      taskId: submission.taskId,
      taskTitle: task.title,
      taskInstructions: task.instructions,
      taskPoints: task.points,
      memberId: submission.userId,
      memberName: user.name,
    })
    .from(submission)
    .innerJoin(task, eq(task.id, submission.taskId))
    .innerJoin(user, eq(user.id, submission.userId))
    .where(eq(submission.id, submissionId))
    .limit(1);
  if (!head) return null;

  const attempts = await db
    .select({
      attemptNo: submissionAttempt.attemptNo,
      body: submissionAttempt.body,
      mediaKey: submissionAttempt.mediaKey,
      submittedAt: submissionAttempt.submittedAt,
      decision: submissionAttempt.decision,
      reviewNote: submissionAttempt.reviewNote,
      earnedPoints: submissionAttempt.earnedPoints,
      reviewedBy: submissionAttempt.reviewedBy,
      reviewedAt: submissionAttempt.reviewedAt,
    })
    .from(submissionAttempt)
    .where(eq(submissionAttempt.submissionId, submissionId))
    .orderBy(asc(submissionAttempt.attemptNo));

  return { ...head, attempts };
}

export type MemberSubmission = {
  taskId: string;
  state: "pending" | "accepted" | "rejected" | "returned" | "draft" | "cancelled";
  body: string | null;
  mediaKey: string | null;
  reviewNote: string | null;
  updatedAt: Date;
};

/**
 * A Member's own Submissions, so their side of the UI can show "under review",
 * "returned — revise", "accepted" or a saved draft rather than a bare button.
 * Scoped to a set of Task ids when the caller has them (a Track page), or all of
 * the Member's Submissions when it does not.
 */
export async function memberSubmissions(
  db: Database,
  userId: string,
  taskIds?: string[],
): Promise<MemberSubmission[]> {
  if (taskIds && taskIds.length === 0) return [];

  const where = taskIds
    ? and(eq(submission.userId, userId), inArray(submission.taskId, taskIds))
    : eq(submission.userId, userId);

  return db
    .select({
      taskId: submission.taskId,
      state: submission.state,
      body: submission.body,
      mediaKey: submission.mediaKey,
      reviewNote: submission.reviewNote,
      updatedAt: submission.updatedAt,
    })
    .from(submission)
    .where(where);
}

/** The next 1-based attempt number for a Submission — max so far plus one. */
async function nextAttemptNo(tx: Queryable, submissionId: string): Promise<number> {
  const [row] = await tx
    .select({ maxNo: sql<number>`coalesce(max(${submissionAttempt.attemptNo}), 0)` })
    .from(submissionAttempt)
    .where(eq(submissionAttempt.submissionId, submissionId));
  return Number(row!.maxNo) + 1;
}

/**
 * Stamp the current (latest, not-yet-decided) attempt with an Editor's verdict.
 * Every review decision lands on exactly the attempt the Editor was looking at —
 * the one the Member last submitted — leaving earlier attempts frozen (§26).
 */
async function stampCurrentAttempt(
  tx: Queryable,
  submissionId: string,
  verdict: {
    decision: "accepted" | "returned" | "rejected";
    earnedPoints: number | null;
    reviewNote: string | null;
    reviewedBy: string;
    reviewedAt: Date;
  },
): Promise<{ attemptNo: number }> {
  const [current] = await tx
    .select({ id: submissionAttempt.id, attemptNo: submissionAttempt.attemptNo })
    .from(submissionAttempt)
    .where(
      and(eq(submissionAttempt.submissionId, submissionId), isNull(submissionAttempt.decision)),
    )
    .orderBy(desc(submissionAttempt.attemptNo))
    .limit(1);
  if (!current) throw new Error(`Submission ${submissionId} has no unreviewed attempt to decide`);

  await tx.update(submissionAttempt).set(verdict).where(eq(submissionAttempt.id, current.id));

  return { attemptNo: current.attemptNo };
}

/** Whether a `user` is staff (an Editor or Admin) — the review authority check. */
async function isStaff(tx: Queryable, userId: string): Promise<boolean> {
  const [row] = await tx.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  return isStaffRole(row?.role ?? null);
}

/**
 * The two gates every review submission shares: the Task must be `review`-mode and
 * published. Returns the refusal status, or null when the Task is open to work.
 */
async function reviewableTaskError(
  tx: Queryable,
  taskId: string,
): Promise<"not-reviewable" | "not-published" | null> {
  const [t] = await tx
    .select({ mode: task.mode, state: task.state })
    .from(task)
    .where(eq(task.id, taskId))
    .limit(1);
  if (!t) throw new Error(`No task ${taskId}`);
  if (t.mode !== "review") return "not-reviewable";
  if (t.state !== "published") return "not-published";
  return null;
}
