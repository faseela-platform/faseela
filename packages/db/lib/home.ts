import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "./client";
import { submission, task, track } from "./content";

/**
 * The tasks that belong at the top of a Member's home (§3.1): the work that is still
 * live for them — a draft or returned Submission they must act on, and pending
 * Submissions awaiting a review. Accepted/rejected/cancelled Submissions are closed
 * and do not appear here.
 *
 * Joined to Task and Track so the home can show each item's title and link it back
 * to its Track. Points and Tier — the rest of §3.1 — come from `memberProgress`
 * (`tiers.ts`); this read is only the task side, so the home assembles the two.
 */
export type MemberHomeTask = {
  taskId: string;
  taskTitle: string;
  trackSlug: string;
  trackTitle: string;
  /** `draft`/`returned` — the Member's move (highlight the open one). `pending` — awaiting review. */
  submissionState: "draft" | "returned" | "pending";
  updatedAt: Date;
};

export async function memberHomeTasks(db: Database, userId: string): Promise<MemberHomeTask[]> {
  const rows = await db
    .select({
      taskId: task.id,
      taskTitle: task.title,
      trackSlug: track.slug,
      trackTitle: track.title,
      submissionState: submission.state,
      updatedAt: submission.updatedAt,
    })
    .from(submission)
    .innerJoin(task, eq(task.id, submission.taskId))
    .innerJoin(track, eq(track.id, task.trackId))
    .where(
      and(
        eq(submission.userId, userId),
        inArray(submission.state, ["draft", "returned", "pending"]),
      ),
    )
    .orderBy(desc(submission.updatedAt));

  /** The `state` column is the full submission enum; here it is only ever one of the
   * three we filtered to, so the narrow cast is honest. */
  return rows as MemberHomeTask[];
}
