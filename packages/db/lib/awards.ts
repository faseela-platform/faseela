import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { submission, task } from "./content";
import { pointAward } from "./progress";
import { currentSeason } from "./seasons";

export type AwardResult =
  | { status: "awarded"; awardId: string; points: number }
  | { status: "already-awarded"; awardId: string; points: number }
  | { status: "no-season" }
  | { status: "not-accepted" };

/**
 * Mint the Points for an accepted Submission.
 *
 * This is the only way Points come into existence, which is why it lives behind
 * the package boundary rather than being assembled at a call site. Three things
 * have to be true at once and stay true under concurrency: exactly one award per
 * Submission, the value frozen at award time, and the Season fixed to when the
 * work was accepted.
 *
 * Idempotency is delegated to the database. `point_award_submission_unique`
 * makes a second insert fail rather than a prior read making it not happen — a
 * read-then-write check is a race, because two concurrent accepts both see no
 * award before either writes. `onConflictDoNothing` turns that race into a
 * no-op, and the caller learns which happened from `status`.
 */
export async function awardPoints(
  db: Database,
  submissionId: string,
  at: Date = new Date(),
): Promise<AwardResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        submissionId: submission.id,
        state: submission.state,
        userId: submission.userId,
        taskId: submission.taskId,
        points: task.points,
      })
      .from(submission)
      .innerJoin(task, eq(task.id, submission.taskId))
      .where(eq(submission.id, submissionId))
      .limit(1);

    const found = rows[0];
    if (!found) throw new Error(`No submission ${submissionId}`);

    /**
     * Points follow acceptance, never the other way round. A caller that wants
     * to award must accept the Submission first, so there is one place where
     * "this work counted" is decided.
     */
    if (found.state !== "accepted") return { status: "not-accepted" };

    const activeSeason = await currentSeason(tx, at);
    if (!activeSeason) return { status: "no-season" };

    const inserted = await tx
      .insert(pointAward)
      .values({
        userId: found.userId,
        seasonId: activeSeason.id,
        taskId: found.taskId,
        submissionId: found.submissionId,
        /** Frozen here. Later edits to task.points must not move this. */
        points: found.points,
        awardedAt: at,
      })
      .onConflictDoNothing({ target: pointAward.submissionId })
      .returning({ id: pointAward.id, points: pointAward.points });

    if (inserted[0]) {
      return {
        status: "awarded",
        awardId: inserted[0].id,
        points: inserted[0].points,
      };
    }

    /**
     * Conflict: an award already exists. Return the existing one so a retried
     * request is indistinguishable from the first, except in `status`.
     */
    const existing = await tx
      .select({ id: pointAward.id, points: pointAward.points })
      .from(pointAward)
      .where(eq(pointAward.submissionId, submissionId))
      .limit(1);

    return {
      status: "already-awarded",
      awardId: existing[0]!.id,
      points: existing[0]!.points,
    };
  });
}
