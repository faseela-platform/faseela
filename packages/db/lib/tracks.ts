import { and, asc, eq, sql } from "drizzle-orm";

import type { Queryable } from "./client";
import { task, track } from "./content";

/**
 * Reading Tracks and their Tasks for the public site.
 *
 * These live in the data layer rather than in the page, for the reason stated in
 * index.ts: the package's surface is deliberately narrow, and a page that can
 * assemble its own queries can also forget the `state = 'published'` filter.
 * There is exactly one way to read published content, and it is here.
 *
 * Draft and archived rows are invisible to every function in this file. That is
 * the whole point — an Editor drafting next season's Track must not have it
 * appear on the site because one query forgot a `where`.
 */

/** A Track as the index page needs it: no Tasks, but a count of them. */
export type TrackSummary = {
  slug: string;
  title: string;
  summary: string;
  position: number;
  taskCount: number;
  totalPoints: number;
};

/** A Track with its published Tasks, as the detail page needs it. */
export type TrackDetail = {
  slug: string;
  title: string;
  summary: string;
  tasks: {
    id: string;
    title: string;
    instructions: string;
    mode: "attest" | "review";
    points: number;
    position: number;
  }[];
  totalPoints: number;
};

/**
 * Published Tracks in Editor-defined order, each with the number of Tasks it
 * holds and the Points those Tasks are collectively worth.
 *
 * The aggregate is computed in one query rather than one per Track: three Tracks
 * would make N+1 invisible now and expensive at thirty. Tasks are counted with a
 * LEFT JOIN so a Track with no published Tasks still appears — حتى يسمع كلام الله
 * is exactly that case today (ADR 0019), and dropping it from the index would
 * hide a real Track because its content is not written yet.
 */
export async function publishedTracks(db: Queryable): Promise<TrackSummary[]> {
  const rows = await db
    .select({
      slug: track.slug,
      title: track.title,
      summary: track.summary,
      position: track.position,
      /**
       * `count(task.id)` rather than `count(*)`: under a LEFT JOIN with no
       * matching Task the joined columns are null, and `count(*)` would count
       * that null row as one Task. Counting a specific non-null column is what
       * makes an empty Track report zero instead of one.
       */
      taskCount: sql<number>`count(${task.id})::int`,
      /** `coalesce` because `sum` over no rows is null, not zero. */
      totalPoints: sql<number>`coalesce(sum(${task.points}), 0)::int`,
    })
    .from(track)
    .leftJoin(task, and(eq(task.trackId, track.id), eq(task.state, "published")))
    .where(eq(track.state, "published"))
    .groupBy(track.id, track.slug, track.title, track.summary, track.position)
    .orderBy(asc(track.position));

  return rows;
}

/**
 * One published Track by slug, with its published Tasks in Editor order.
 *
 * Returns null for an unknown slug *and* for a slug that exists but is not
 * published, deliberately conflating the two: distinguishing them would let
 * anyone enumerate unpublished Tracks by watching which slugs 404 and which
 * return a different error.
 */
export async function trackBySlug(db: Queryable, slug: string): Promise<TrackDetail | null> {
  const trackRows = await db
    .select({
      id: track.id,
      slug: track.slug,
      title: track.title,
      summary: track.summary,
    })
    .from(track)
    .where(and(eq(track.slug, slug), eq(track.state, "published")))
    .limit(1);

  const found = trackRows[0];
  if (!found) return null;

  const taskRows = await db
    .select({
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      mode: task.mode,
      points: task.points,
      position: task.position,
    })
    .from(task)
    .where(and(eq(task.trackId, found.id), eq(task.state, "published")))
    .orderBy(asc(task.position));

  return {
    slug: found.slug,
    title: found.title,
    summary: found.summary,
    tasks: taskRows,
    totalPoints: taskRows.reduce((sum, t) => sum + t.points, 0),
  };
}
