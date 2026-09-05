import { and, desc, eq, ne } from "drizzle-orm";

import type { Database } from "./client";
import { submission, task, track } from "./content";
import { pointAward } from "./progress";

/**
 * سجل أعمالي (§30 addition, owner decision 2026-09-01) — the Member's own record
 * on حسابي. Two halves, two sources of truth:
 *
 * - **completed** reads the LEDGER (`point_award`), not submissions, because the
 *   ledger is what §8 makes authoritative for earned Points — its `points` are the
 *   minted value, frozen at award time (ADR 0015), which a Task edit can never
 *   rewrite.
 * - **submissions** is the open (and closed-unhappily) review work: draft, pending,
 *   returned, rejected, cancelled — each with its true state, so the record never
 *   flatters. Accepted submissions are absent here on purpose: their award IS the
 *   completed entry, and one deed must not appear twice.
 *
 * Personal only — no other Member's name or work can reach this read.
 */
export type CompletedWork = {
  taskTitle: string;
  trackSlug: string;
  trackTitle: string;
  points: number;
  awardedAt: Date;
};
export type OpenWork = {
  taskTitle: string;
  trackSlug: string;
  trackTitle: string;
  state: "draft" | "pending" | "returned" | "rejected" | "cancelled";
  updatedAt: Date;
};
export type WorkRecord = { completed: CompletedWork[]; submissions: OpenWork[] };

export async function memberWorkRecord(db: Database, userId: string): Promise<WorkRecord> {
  const completed = await db
    .select({
      taskTitle: task.title,
      trackSlug: track.slug,
      trackTitle: track.title,
      points: pointAward.points,
      awardedAt: pointAward.awardedAt,
    })
    .from(pointAward)
    .innerJoin(task, eq(task.id, pointAward.taskId))
    .innerJoin(track, eq(track.id, task.trackId))
    .where(eq(pointAward.userId, userId))
    .orderBy(desc(pointAward.awardedAt));

  const open = await db
    .select({
      taskTitle: task.title,
      trackSlug: track.slug,
      trackTitle: track.title,
      state: submission.state,
      updatedAt: submission.updatedAt,
    })
    .from(submission)
    .innerJoin(task, eq(task.id, submission.taskId))
    .innerJoin(track, eq(track.id, task.trackId))
    .where(and(eq(submission.userId, userId), ne(submission.state, "accepted")))
    .orderBy(desc(submission.updatedAt));

  const isOpenState = (v: string): v is OpenWork["state"] =>
    v === "draft" || v === "pending" || v === "returned" || v === "rejected" || v === "cancelled";
  return {
    completed,
    submissions: open.flatMap((w) => (isOpenState(w.state) ? [{ ...w, state: w.state }] : [])),
  };
}
