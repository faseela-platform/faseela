import { and, desc, eq, lt } from "drizzle-orm";

import type { Database } from "./client";
import { contentItem, track } from "./content";
import type { ContentType } from "./content-admin";

/**
 * The public read behind the Feed / home page (§3): published content, newest first,
 * one merged stream regardless of type ("don't split into many sections" — §3.3).
 * Track-scoped and track-less pieces read the same; the join carries the Track's
 * slug so the UI can link an item back to its Track.
 *
 * Only `published` content is returned — a draft is not on the front page — so
 * `published_at` is always present (the biconditional CHECK guarantees it), and the
 * result narrows it to non-null for the caller.
 */
export type FeedItem = {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  classification: string | null;
  mediaKey: string | null;
  linkUrl: string | null;
  eventAt: Date | null;
  eventPlace: string | null;
  publishedAt: Date;
  taskId: string | null;
  trackId: string | null;
  trackSlug: string | null;
  trackTitle: string | null;
};

/**
 * A page of the Feed. `before` (a `published_at`) drives simple keyset pagination —
 * pass the oldest `publishedAt` you have to fetch the next page, so the stream can
 * grow without an offset that drifts as new content is published.
 */
export async function feedItems(
  db: Database,
  opts?: { limit?: number; before?: Date },
): Promise<FeedItem[]> {
  const limit = opts?.limit ?? 30;
  const where = opts?.before
    ? and(eq(contentItem.state, "published"), lt(contentItem.publishedAt, opts.before))
    : eq(contentItem.state, "published");

  const rows = await db
    .select({
      id: contentItem.id,
      type: contentItem.type,
      title: contentItem.title,
      body: contentItem.body,
      classification: contentItem.classification,
      mediaKey: contentItem.mediaKey,
      linkUrl: contentItem.linkUrl,
      eventAt: contentItem.eventAt,
      eventPlace: contentItem.eventPlace,
      publishedAt: contentItem.publishedAt,
      taskId: contentItem.taskId,
      trackId: contentItem.trackId,
      trackSlug: track.slug,
      trackTitle: track.title,
    })
    .from(contentItem)
    .leftJoin(track, eq(track.id, contentItem.trackId))
    .where(where)
    .orderBy(desc(contentItem.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt! }));
}
