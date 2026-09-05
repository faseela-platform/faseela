import { and, count, eq, inArray } from "drizzle-orm";

import type { Database, Queryable } from "./client";
import { submission, task, track, trackFollow } from "./content";
import { UUID_RE } from "./track-content";

/**
 * متابعة المسار (§10) — the explicit follow relation, R3.
 *
 * The deep-module contract: callers say *what* («follow this Track»), these
 * functions own the guards. A follow targets only a published Track — an unknown
 * and an unpublished id fail indistinguishably (`not-found`), the same posture as
 * `trackBySlug`, so a draft cannot be discovered by probing follow ids. Both
 * writes are idempotent with a *stated* outcome rather than a silent one, because
 * the API layer turns these statuses into responses.
 */
export type FollowResult = { status: "followed" | "already-following" | "not-found" };
export type UnfollowResult = { status: "unfollowed" | "not-following" };

export async function followTrack(
  db: Database,
  userId: string,
  trackId: string,
): Promise<FollowResult> {
  if (!UUID_RE.test(trackId)) return { status: "not-found" };
  const [row] = await db
    .select({ id: track.id })
    .from(track)
    .where(and(eq(track.id, trackId), eq(track.state, "published")));
  if (!row) return { status: "not-found" };

  const inserted = await db
    .insert(trackFollow)
    .values({ trackId, userId })
    .onConflictDoNothing()
    .returning({ id: trackFollow.id });
  return { status: inserted.length > 0 ? "followed" : "already-following" };
}

export async function unfollowTrack(
  db: Database,
  userId: string,
  trackId: string,
): Promise<UnfollowResult> {
  if (!UUID_RE.test(trackId)) return { status: "not-following" };
  const deleted = await db
    .delete(trackFollow)
    .where(and(eq(trackFollow.trackId, trackId), eq(trackFollow.userId, userId)))
    .returning({ id: trackFollow.id });
  return { status: deleted.length > 0 ? "unfollowed" : "not-following" };
}

/**
 * Working in a Track follows it — but only the FIRST work. Called inside the
 * attest/submission transactions (a `Queryable`, like the notification emits, so
 * a rolled-back attest follows nothing). First-work-only is what keeps unfollow
 * honest: a Member who unfollowed and keeps contributing has already answered
 * «do you want this Track's updates؟» — silently re-subscribing them on every
 * later action would make that answer worthless. Prior work is read BEFORE the
 * caller records the new work, so "first" means first.
 */
export async function followOnFirstWork(
  tx: Queryable,
  userId: string,
  trackId: string,
): Promise<void> {
  const prior = await tx
    .select({ id: submission.id })
    .from(submission)
    .innerJoin(task, eq(task.id, submission.taskId))
    .where(and(eq(task.trackId, trackId), eq(submission.userId, userId)))
    .limit(1);
  if (prior.length > 0) return;
  await tx.insert(trackFollow).values({ trackId, userId }).onConflictDoNothing();
}

/** The taskId-taking variant of `followOnFirstWork` — the submit/draft transactions
 * know only the Task; the task→track walk belongs here, not at every call site. */
export async function followOnFirstWorkForTask(
  tx: Queryable,
  userId: string,
  taskId: string,
): Promise<void> {
  const [t] = await tx
    .select({ trackId: task.trackId })
    .from(task)
    .where(eq(task.id, taskId))
    .limit(1);
  if (t) await followOnFirstWork(tx, userId, t.trackId);
}

/** The Member's followed Tracks — the set zone 2 (§3) and §9's ordering read. */
export async function followedTrackIds(db: Database, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ trackId: trackFollow.trackId })
    .from(trackFollow)
    .where(eq(trackFollow.userId, userId));
  return new Set(rows.map((r) => r.trackId));
}

/**
 * Followers per Track (§11), zero included — the page must say «٠ متابع»
 * honestly rather than omit the count for a young Track.
 */
export async function trackFollowerCounts(
  db: Database,
  trackIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(trackIds.map((id) => [id, 0]));
  if (trackIds.length === 0) return counts;
  const rows = await db
    .select({ trackId: trackFollow.trackId, n: count() })
    .from(trackFollow)
    .where(inArray(trackFollow.trackId, [...trackIds]))
    .groupBy(trackFollow.trackId);
  for (const r of rows) counts.set(r.trackId, Number(r.n));
  return counts;
}
