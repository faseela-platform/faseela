import { and, desc, eq } from "drizzle-orm";

/** A malformed id must answer with absence, never a Postgres cast error → 500. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import type { Database } from "./client";
import { contentItem, task, track } from "./content";
import type { ContentType } from "./content-admin";

/**
 * محتوى المسار — the reads behind §13's content tab, §14's content page and §15's
 * two roads between a Task and its content, bounded by §19's filter
 * (`task.content_scope`: null = about no content; "track" = the whole Track's
 * published content; anything else = a classification within the Track).
 *
 * Only `published` rows come back anywhere here, and a draft id resolves exactly
 * like an unknown one — the same posture as `trackBySlug`, so unpublished work
 * cannot be probed by id.
 */

export type TrackContentItem = {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  classification: string | null;
  mediaKey: string | null;
  linkUrl: string | null;
  publishedAt: Date;
};

export async function trackContentItems(
  db: Database,
  trackId: string,
  opts?: { classification?: string },
): Promise<TrackContentItem[]> {
  const rows = await db
    .select({
      id: contentItem.id,
      type: contentItem.type,
      title: contentItem.title,
      body: contentItem.body,
      classification: contentItem.classification,
      mediaKey: contentItem.mediaKey,
      linkUrl: contentItem.linkUrl,
      publishedAt: contentItem.publishedAt,
    })
    .from(contentItem)
    .where(
      and(
        eq(contentItem.trackId, trackId),
        eq(contentItem.state, "published"),
        ...(opts?.classification ? [eq(contentItem.classification, opts.classification)] : []),
      ),
    )
    .orderBy(desc(contentItem.publishedAt));
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt! }));
}

/** A Task as §14 lists it under the content: enough to start working. */
export type LinkedTask = {
  id: string;
  title: string;
  instructions: string;
  mode: "attest" | "review";
  points: number;
};

export type ContentItemPage = TrackContentItem & {
  trackId: string | null;
  trackSlug: string | null;
  trackTitle: string | null;
  eventAt: Date | null;
  eventPlace: string | null;
  /**
   * §15 path 1: الكتاب ← المهام المرتبطة به. A Task is linked when its scope
   * admits this item — the whole Track, or the item's classification. A Task
   * with no scope is about no content and never appears here.
   */
  linkedTasks: LinkedTask[];
};

export async function contentItemById(db: Database, id: string): Promise<ContentItemPage | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
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
      trackId: contentItem.trackId,
      trackSlug: track.slug,
      trackTitle: track.title,
    })
    .from(contentItem)
    .leftJoin(track, eq(track.id, contentItem.trackId))
    .where(and(eq(contentItem.id, id), eq(contentItem.state, "published")))
    .limit(1);
  if (!row) return null;

  let linkedTasks: LinkedTask[] = [];
  if (row.trackId) {
    const candidates = await db
      .select({
        id: task.id,
        title: task.title,
        instructions: task.instructions,
        mode: task.mode,
        points: task.points,
        contentScope: task.contentScope,
      })
      .from(task)
      .where(and(eq(task.trackId, row.trackId), eq(task.state, "published")))
      .orderBy(task.position);
    linkedTasks = candidates
      .filter(
        (t) =>
          t.contentScope === "track" ||
          (t.contentScope !== null && t.contentScope === row.classification),
      )
      .map(({ contentScope: _scope, ...t }) => t);
  }

  return { ...row, publishedAt: row.publishedAt!, linkedTasks };
}

/**
 * §15 path 2: المهمة ← اختيار المحتوى. What the Member may choose for a scoped
 * Task — the Track's published content, narrowed to the scope's classification
 * when it names one. An unscoped or unknown Task offers nothing.
 */
export async function taskContentChoices(
  db: Database,
  taskId: string,
): Promise<TrackContentItem[]> {
  if (!UUID_RE.test(taskId)) return [];
  /** Published only — a draft Task's scope is nobody's business yet (drafts are
   * invisible to Members everywhere; a leaked choices list would break that). */
  const [t] = await db
    .select({ trackId: task.trackId, contentScope: task.contentScope })
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.state, "published")))
    .limit(1);
  if (!t || t.contentScope === null) return [];
  return trackContentItems(
    db,
    t.trackId,
    t.contentScope === "track" ? undefined : { classification: t.contentScope },
  );
}
