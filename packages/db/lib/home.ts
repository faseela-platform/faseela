import { and, desc, eq, inArray, notInArray } from "drizzle-orm";

import type { Database } from "./client";
import { contentItem, submission, task, track, trackFollow } from "./content";

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

/** Zone 2 (§3): one followed Track and its latest published word, if any. */
export type FollowedTrackCard = {
  trackId: string;
  slug: string;
  title: string;
  latest: { id: string; title: string; publishedAt: Date } | null;
};

/**
 * The Member's followed Tracks in position order, each with the newest published
 * content item — «مسارات تتابعها وآخر تحديثاتها». A followed Track with nothing
 * published still appears: followed is followed, and an empty card is honest.
 */
export async function followedTracksWithLatest(
  db: Database,
  userId: string,
): Promise<FollowedTrackCard[]> {
  const followed = await db
    .select({ trackId: track.id, slug: track.slug, title: track.title })
    .from(trackFollow)
    .innerJoin(track, eq(track.id, trackFollow.trackId))
    .where(and(eq(trackFollow.userId, userId), eq(track.state, "published")))
    .orderBy(track.position);
  if (followed.length === 0) return [];

  const latestRows = await db
    .selectDistinctOn([contentItem.trackId], {
      trackId: contentItem.trackId,
      id: contentItem.id,
      title: contentItem.title,
      publishedAt: contentItem.publishedAt,
    })
    .from(contentItem)
    .where(
      and(
        inArray(
          contentItem.trackId,
          followed.map((f) => f.trackId),
        ),
        eq(contentItem.state, "published"),
      ),
    )
    .orderBy(contentItem.trackId, desc(contentItem.publishedAt));
  const latestByTrack = new Map(latestRows.map((r) => [r.trackId!, r]));

  return followed.map((f) => {
    const latest = latestByTrack.get(f.trackId);
    return {
      ...f,
      latest: latest
        ? { id: latest.id, title: latest.title, publishedAt: latest.publishedAt! }
        : null,
    };
  });
}

/**
 * Zone 5 (§3) — simple discovery: the published Tracks the Member does NOT follow,
 * position order. The honest version of «اكتشف» the owner chose; the smart
 * recommender stays deferred, as §3 itself allows.
 */
export async function discoveryTracks(
  db: Database,
  userId: string,
): Promise<{ trackId: string; slug: string; title: string; summary: string }[]> {
  const followedIds = await db
    .select({ trackId: trackFollow.trackId })
    .from(trackFollow)
    .where(eq(trackFollow.userId, userId));
  const excluded = followedIds.map((f) => f.trackId);
  return db
    .select({ trackId: track.id, slug: track.slug, title: track.title, summary: track.summary })
    .from(track)
    .where(
      and(
        eq(track.state, "published"),
        ...(excluded.length > 0 ? [notInArray(track.id, excluded)] : []),
      ),
    )
    .orderBy(track.position);
}

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
