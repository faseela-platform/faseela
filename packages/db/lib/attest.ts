import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "./client";
import { submission, task } from "./content";
import { pointAward } from "./progress";
import { currentSeason } from "./seasons";

export type AttestResult =
  | { status: "completed"; submissionId: string; awardId: string; points: number }
  | { status: "already-completed"; submissionId: string; awardId: string; points: number }
  | { status: "not-attestable" }
  | { status: "not-published" }
  | { status: "no-season" };

/**
 * Complete an `attest` Task on the Member's own declaration, minting Points at
 * once.
 *
 * `acceptSubmission` (in review.ts) mints from work an Editor has accepted, which
 * is the `review` path: a human decides, then Points follow. This is the other
 * path, and it differs in exactly one way — the Member's declaration *is* the
 * acceptance, so the Submission is created accepted and the award happens in the
 * same transaction. Everything else is deliberately identical, including which
 * constraints do the enforcing.
 *
 * It is a separate function rather than a flag on `acceptSubmission` because the
 * two have different preconditions: acceptance must refuse anything not pending
 * review, while this must refuse anything not `attest`. Collapsing them into one
 * function with a boolean would mean a single wrong argument could mint Points for
 * unreviewed creative work, which is the one thing the review queue exists to
 * prevent.
 *
 * ## What guards this
 *
 * **Mode.** A `review` Task can never be completed here. Checked against the
 * database row, never against anything the caller passed in — a caller who could
 * assert the mode could mint 50 Points for an unread essay.
 *
 * **Publication.** A draft Task is not completable. Without this, an Editor
 * drafting next Season's Tasks would find Members had already banked them,
 * because a draft's id is guessable from the API the moment it exists.
 *
 * **Season.** Resolved from `at`, and null is fatal rather than defaulted. Effort
 * outside a Season cannot be ranked, so refusing is the honest answer.
 *
 * **Idempotency.** Two unique indexes, not a prior read.
 * `submission_task_user_unique` collapses a double-tapped button, and
 * `point_award_submission_unique` guarantees one award per Submission even if the
 * first insert somehow succeeded twice. A read-then-write check would be a race:
 * two concurrent requests both see no submission before either writes, and the
 * Member banks the Points twice. The check runs inside a transaction so a
 * conflict on either index leaves nothing behind.
 */
export async function attestTask(
  db: Database,
  taskId: string,
  userId: string,
  at: Date = new Date(),
): Promise<AttestResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: task.id,
        mode: task.mode,
        state: task.state,
        points: task.points,
      })
      .from(task)
      .where(eq(task.id, taskId))
      .limit(1);

    const found = rows[0];
    if (!found) throw new Error(`No task ${taskId}`);

    /**
     * Order matters for the caller's sake: a Member asking to attest a `review`
     * Task has hit a UI bug, while an unpublished Task is a timing problem. They
     * get different statuses so the two are distinguishable in logs.
     */
    if (found.mode !== "attest") return { status: "not-attestable" };
    if (found.state !== "published") return { status: "not-published" };

    const activeSeason = await currentSeason(tx, at);
    if (!activeSeason) return { status: "no-season" };

    /**
     * `state: "accepted"` with `reviewedBy` and `reviewedAt` both left null. The
     * `submission_reviewed_together` CHECK requires those two to be null or
     * non-null together, and an attestation genuinely has no reviewer — writing
     * the Member's own id there would record a review that never happened, and
     * make the review queue's own numbers lie.
     */
    const insertedSubmission = await tx
      .insert(submission)
      .values({
        taskId: found.id,
        userId,
        /** Null by schema contract: an attestation has nothing to submit. */
        body: null,
        state: "accepted",
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoNothing({ target: [submission.taskId, submission.userId] })
      .returning({ id: submission.id });

    /**
     * Conflict on the submission index: this Member already completed this Task.
     * Return the existing award so a retry is indistinguishable from the first
     * call, and so a Member who taps twice is not told their work failed.
     */
    if (!insertedSubmission[0]) {
      const existing = await tx
        .select({
          submissionId: submission.id,
          awardId: pointAward.id,
          points: pointAward.points,
        })
        .from(submission)
        .innerJoin(pointAward, eq(pointAward.submissionId, submission.id))
        .where(and(eq(submission.taskId, found.id), eq(submission.userId, userId)))
        .limit(1);

      const prior = existing.find(() => true);
      if (!prior) {
        /**
         * A Submission exists with no award. Reachable only if a previous call
         * crashed between the two inserts — impossible inside this transaction,
         * but possible for a Submission created by another path, such as a
         * `review` Task later switched to `attest`. Raising is correct: silently
         * minting here would award Points for work whose Submission was never
         * examined.
         */
        throw new Error(
          `Submission for task ${taskId} exists without an award; refusing to mint retroactively`,
        );
      }
      return {
        status: "already-completed",
        submissionId: prior.submissionId,
        awardId: prior.awardId,
        points: prior.points,
      };
    }

    const insertedAward = await tx
      .insert(pointAward)
      .values({
        userId,
        seasonId: activeSeason.id,
        taskId: found.id,
        submissionId: insertedSubmission[0].id,
        /**
         * Copied from the Task now and never read through the join again. An
         * Editor raising a Task from 20 to 30 Points must not retroactively
         * change what earlier Members earned — see ADR 0015.
         */
        points: found.points,
        awardedAt: at,
      })
      .returning({ id: pointAward.id, points: pointAward.points });

    return {
      status: "completed",
      submissionId: insertedSubmission[0].id,
      awardId: insertedAward[0]!.id,
      points: insertedAward[0]!.points,
    };
  });
}

/**
 * Which of these Tasks the Member has already *completed* — accepted, not merely
 * attempted.
 *
 * Exists so the Track page can render a completed Task as done rather than
 * offering a button that will be refused. Scoped to `state = 'accepted'`: a
 * `review` Task that is drafted, pending or returned is work in progress, not a
 * completion, and showing it as done would tell the Member they had finished
 * something an Editor has not yet accepted. An `attest` completion is stored
 * accepted too, so the one filter is right for both modes. Returns a Set of task
 * ids: the page needs membership, not the Submission rows, and returning the rows
 * would invite a caller to read `state` from them and reimplement this rule.
 */
export async function completedTaskIds(
  db: Database,
  userId: string,
  taskIds: string[],
): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();

  const rows = await db
    .select({ taskId: submission.taskId })
    .from(submission)
    .where(
      and(
        eq(submission.userId, userId),
        eq(submission.state, "accepted"),
        inArray(submission.taskId, taskIds),
      ),
    );

  return new Set(rows.map((r) => r.taskId));
}

/**
 * A Member's total Points in one Season.
 *
 * Summed from the ledger on every call rather than cached on the user row. The
 * ledger is the source of truth (ADR 0015), and a stored total is a second one
 * that drifts.
 */
export async function memberSeasonPoints(
  db: Database,
  userId: string,
  seasonId: string,
): Promise<number> {
  const rows = await db
    .select({ points: pointAward.points })
    .from(pointAward)
    .where(and(eq(pointAward.userId, userId), eq(pointAward.seasonId, seasonId)));

  return rows.reduce((sum, r) => sum + r.points, 0);
}
