import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import type { Database } from "./client";
import { track } from "./content";
import { user } from "./identity";
import { notification } from "./notification";

/**
 * The reader's side of §38: what is in my bell, how many of them are new, and
 * marking them read.
 *
 * "New" is decided against a single timestamp on the Member — everything published
 * after the last time they opened the list. That is what makes §3's rule cheap to
 * honour («لا يُعرض في كل دخول… حتى لا يكرر عرضه»): no row per member per
 * notification, and a broadcast to a thousand members writes one row, not a thousand.
 */

export type MemberNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  trackId: string | null;
  trackSlug: string | null;
  trackTitle: string | null;
  taskId: string | null;
  publishedAt: Date;
  /** Whether this was already published the last time the Member looked. */
  seen: boolean;
};

/** Addressed to me, or to everyone. */
const visibleTo = (userId: string) =>
  or(eq(notification.userId, userId), isNull(notification.userId));

export async function notificationsFor(
  db: Database,
  userId: string,
  opts?: { limit?: number },
): Promise<MemberNotification[]> {
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      linkUrl: notification.linkUrl,
      trackId: notification.trackId,
      trackSlug: track.slug,
      trackTitle: track.title,
      taskId: notification.taskId,
      publishedAt: notification.publishedAt,
      /** Computed against the reader's own watermark, in the same query. */
      seen: sql<boolean>`${notification.publishedAt} <= ${user.lastNotificationsSeenAt}`,
    })
    .from(notification)
    .innerJoin(user, eq(user.id, userId))
    .leftJoin(track, eq(track.id, notification.trackId))
    .where(and(eq(notification.state, "published"), visibleTo(userId)))
    .orderBy(desc(notification.publishedAt))
    .limit(opts?.limit ?? 50);

  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt!, seen: Boolean(r.seen) }));
}

/** The badge: how many are newer than the reader's watermark. */
export async function unreadNotificationCount(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .innerJoin(user, eq(user.id, userId))
    .where(
      and(
        eq(notification.state, "published"),
        visibleTo(userId),
        gt(notification.publishedAt, user.lastNotificationsSeenAt),
      ),
    );
  return Number(row?.count ?? 0);
}

/**
 * Move the watermark to now — everything published so far becomes read.
 *
 * `greatest` rather than a plain assignment: two tabs, or a slow request that lands
 * after a newer one, must not be able to drag the mark backwards and resurrect
 * notifications the Member has already dismissed.
 */
export async function markNotificationsSeen(
  db: Database,
  userId: string,
  at: Date = new Date(),
): Promise<{ status: "ok" }> {
  await db
    .update(user)
    .set({ lastNotificationsSeenAt: sql`greatest(${user.lastNotificationsSeenAt}, ${at})` })
    .where(eq(user.id, userId));
  return { status: "ok" };
}
