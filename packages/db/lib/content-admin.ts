import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

import type { Database, Queryable } from "./client";
import { contentItem, task, track, trackSupervisor } from "./content";
import { emitTrackUpdate } from "./notification-emit";
import { pointAward } from "./progress";

/**
 * The admin authoring layer (spec §34/§35): create and manage Tracks and Tasks —
 * the writes that used to live only in `scripts/seed.mjs`.
 *
 * Two rules run through everything here. First, a published Track or Task **must**
 * carry a `published_at` and a non-published one **must not** (the biconditional
 * `*_published_has_date` CHECK) — so every state change sets or clears the date in
 * the same write. Second, results are returned as unions, not thrown, exactly as
 * `attest.ts`/`review.ts` do. *Who* may call these is enforced one layer up, in the
 * `/idara` route gates (§36) — this module is the mechanism, not the authority.
 */

/** Slugs are Latin-only by policy — Arabic percent-encodes into unreadable URLs. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ------------------------------------------------------------------ Track

export type CreateTrackResult =
  { status: "created"; id: string } | { status: "invalid-slug" } | { status: "slug-taken" };

export async function createTrack(
  db: Database,
  input: { slug: string; title: string; summary: string; position?: number },
  at: Date = new Date(),
): Promise<CreateTrackResult> {
  if (!SLUG_RE.test(input.slug)) return { status: "invalid-slug" };

  const inserted = await db
    .insert(track)
    .values({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      position: input.position ?? 0,
      state: "draft",
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoNothing({ target: track.slug })
    .returning({ id: track.id });

  return inserted[0] ? { status: "created", id: inserted[0].id } : { status: "slug-taken" };
}

export type UpdateTrackResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "invalid-slug" }
  | { status: "slug-taken" };

export async function updateTrack(
  db: Database,
  id: string,
  input: { title?: string; summary?: string; position?: number; slug?: string },
  at: Date = new Date(),
): Promise<UpdateTrackResult> {
  if (input.slug !== undefined && !SLUG_RE.test(input.slug)) return { status: "invalid-slug" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: track.id })
      .from(track)
      .where(eq(track.id, id))
      .limit(1);
    if (!existing) return { status: "not-found" };

    if (input.slug !== undefined) {
      const [clash] = await tx
        .select({ id: track.id })
        .from(track)
        .where(and(eq(track.slug, input.slug), ne(track.id, id)))
        .limit(1);
      if (clash) return { status: "slug-taken" };
    }

    await tx
      .update(track)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        updatedAt: at,
      })
      .where(eq(track.id, id));
    return { status: "updated" };
  });
}

/**
 * Move a Track between states, keeping the `published_at` invariant: publishing
 * stamps the date (or keeps the one it already had, so re-publishing never rewrites
 * history), archiving/unpublishing clears it. Returns false for a missing Track.
 */
async function setTrackState(
  db: Database,
  id: string,
  state: "published" | "archived" | "draft",
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ publishedAt: track.publishedAt })
      .from(track)
      .where(eq(track.id, id))
      .limit(1);
    if (!row) return false;
    const publishedAt = state === "published" ? (row.publishedAt ?? at) : null;
    await tx.update(track).set({ state, publishedAt, updatedAt: at }).where(eq(track.id, id));
    return true;
  });
}

export async function publishTrack(db: Database, id: string, at: Date = new Date()) {
  return (await setTrackState(db, id, "published", at))
    ? ({ status: "published" } as const)
    : ({ status: "not-found" } as const);
}
export async function archiveTrack(db: Database, id: string, at: Date = new Date()) {
  return (await setTrackState(db, id, "archived", at))
    ? ({ status: "archived" } as const)
    : ({ status: "not-found" } as const);
}
export async function unpublishTrack(db: Database, id: string, at: Date = new Date()) {
  return (await setTrackState(db, id, "draft", at))
    ? ({ status: "unpublished" } as const)
    : ({ status: "not-found" } as const);
}

// ------------------------------------------------------------------- Task

export type CreateTaskResult =
  { status: "created"; id: string } | { status: "track-not-found" } | { status: "invalid-points" };

export async function createTask(
  db: Database,
  input: {
    trackId: string;
    title: string;
    instructions: string;
    mode: "attest" | "review";
    points: number;
    position?: number;
    /** §19 — what content the Member may choose from: null, "track", or a classification. */
    contentScope?: string | null;
  },
  at: Date = new Date(),
): Promise<CreateTaskResult> {
  if (!Number.isInteger(input.points) || input.points < 1) return { status: "invalid-points" };

  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ id: track.id })
      .from(track)
      .where(eq(track.id, input.trackId))
      .limit(1);
    if (!t) return { status: "track-not-found" };

    /** No stated position → the end of the road: after every existing Task, any
     * state (an unpublished 05 must not collide with a published 05 later). The
     * admin form never asks for a position, so this default IS the ordering. */
    const [last] = await tx
      .select({ max: sql<number | null>`max(${task.position})` })
      .from(task)
      .where(eq(task.trackId, input.trackId));
    const position = input.position ?? (last?.max ?? -1) + 1;

    const [inserted] = await tx
      .insert(task)
      .values({
        trackId: input.trackId,
        title: input.title,
        instructions: input.instructions,
        mode: input.mode,
        points: input.points,
        position,
        /** §19 scopes belong to review Tasks only: an attest records no submission
         * content (§42's المحتوى المختار has nowhere to land), so a scope on an
         * attest Task would be a promise the flow cannot keep. Coerced, not
         * refused — the admin form shows the field for both modes. */
        contentScope: input.mode === "review" ? (input.contentScope ?? null) : null,
        state: "draft",
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: task.id });
    /* A plain insert with no onConflict always returns its row; guard for the type. */
    if (!inserted) throw new Error("task insert returned no row");
    return { status: "created", id: inserted.id };
  });
}

export type UpdateTaskResult =
  { status: "updated" } | { status: "not-found" } | { status: "invalid-points" };

export async function updateTask(
  db: Database,
  id: string,
  input: {
    title?: string;
    instructions?: string;
    mode?: "attest" | "review";
    points?: number;
    position?: number;
  },
  at: Date = new Date(),
): Promise<UpdateTaskResult> {
  if (input.points !== undefined && (!Number.isInteger(input.points) || input.points < 1)) {
    return { status: "invalid-points" };
  }
  const updated = await db
    .update(task)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.points !== undefined ? { points: input.points } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      updatedAt: at,
    })
    .where(eq(task.id, id))
    .returning({ id: task.id });
  return updated.length > 0 ? { status: "updated" } : { status: "not-found" };
}

async function setTaskState(
  db: Database,
  id: string,
  state: "published" | "archived" | "draft",
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ publishedAt: task.publishedAt })
      .from(task)
      .where(eq(task.id, id))
      .limit(1);
    if (!row) return false;
    const publishedAt = state === "published" ? (row.publishedAt ?? at) : null;
    await tx.update(task).set({ state, publishedAt, updatedAt: at }).where(eq(task.id, id));
    return true;
  });
}

export async function publishTask(db: Database, id: string, at: Date = new Date()) {
  return (await setTaskState(db, id, "published", at))
    ? ({ status: "published" } as const)
    : ({ status: "not-found" } as const);
}
export async function archiveTask(db: Database, id: string, at: Date = new Date()) {
  return (await setTaskState(db, id, "archived", at))
    ? ({ status: "archived" } as const)
    : ({ status: "not-found" } as const);
}
export async function unpublishTask(db: Database, id: string, at: Date = new Date()) {
  return (await setTaskState(db, id, "draft", at))
    ? ({ status: "unpublished" } as const)
    : ({ status: "not-found" } as const);
}

export type DeleteTaskResult =
  { status: "deleted" } | { status: "not-found" } | { status: "has-awards" };

/**
 * Delete a Task — but only if nothing was ever earned against it. A Task with a
 * Point award is the record that a Member did the work; `point_award.task_id` is
 * `RESTRICT`, and the honest lifecycle end for such a Task is **archive**, not
 * delete. Checking first turns the database's RESTRICT into a clean status.
 */
export async function deleteTask(db: Database, id: string): Promise<DeleteTaskResult> {
  return db.transaction(async (tx) => {
    const [t] = await tx.select({ id: task.id }).from(task).where(eq(task.id, id)).limit(1);
    if (!t) return { status: "not-found" };

    const [award] = await tx
      .select({ id: pointAward.id })
      .from(pointAward)
      .where(eq(pointAward.taskId, id))
      .limit(1);
    if (award) return { status: "has-awards" };

    await tx.delete(task).where(eq(task.id, id));
    return { status: "deleted" };
  });
}

// --------------------------------------------------------- Admin reads

export type AdminTrackRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  state: "draft" | "published" | "archived";
  position: number;
  publishedAt: Date | null;
  taskCount: number;
  totalPoints: number;
};

/**
 * Every Track, whatever its state, with Task counts — the authoring list. Unlike
 * the public `publishedTracks`, drafts and archived Tracks appear (you cannot edit
 * what you cannot see). Scoped to one supervisor's Tracks when `supervisorId` is
 * given (§35): a supervisor's list shows only what they may manage.
 */
export async function adminTracks(
  db: Database,
  opts?: { supervisorId?: string },
): Promise<AdminTrackRow[]> {
  const base = db
    .select({
      id: track.id,
      slug: track.slug,
      title: track.title,
      summary: track.summary,
      state: track.state,
      position: track.position,
      publishedAt: track.publishedAt,
      taskCount: sql<number>`count(${task.id})::int`,
      totalPoints: sql<number>`coalesce(sum(${task.points}), 0)::int`,
    })
    .from(track)
    .leftJoin(task, eq(task.trackId, track.id))
    .$dynamic();

  const scoped = opts?.supervisorId
    ? base.where(
        sql`exists (select 1 from ${trackSupervisor} ts where ts.track_id = ${track.id} and ts.user_id = ${opts.supervisorId})`,
      )
    : base;

  const rows = await scoped
    .groupBy(
      track.id,
      track.slug,
      track.title,
      track.summary,
      track.state,
      track.position,
      track.publishedAt,
    )
    .orderBy(asc(track.position));

  return rows.map((r) => ({
    ...r,
    taskCount: Number(r.taskCount),
    totalPoints: Number(r.totalPoints),
  }));
}

export type AdminTaskRow = {
  id: string;
  title: string;
  instructions: string;
  mode: "attest" | "review";
  points: number;
  state: "draft" | "published" | "archived";
  position: number;
  publishedAt: Date | null;
};

export type AdminTrackDetail = Omit<AdminTrackRow, "taskCount" | "totalPoints"> & {
  tasks: AdminTaskRow[];
};

/**
 * The Track a Task belongs to, or null — so a Task action can gate on its Track's
 * scope (a supervisor may edit a Task only in a Track they run). Reads the *real*
 * link from the row, never trusting a Track id the caller passed alongside.
 */
export async function taskTrackId(db: Database, taskId: string): Promise<string | null> {
  const [row] = await db
    .select({ trackId: task.trackId })
    .from(task)
    .where(eq(task.id, taskId))
    .limit(1);
  return row?.trackId ?? null;
}

/** One Track with all its Tasks, any state — the authoring detail view. */
export async function adminTrack(db: Database, id: string): Promise<AdminTrackDetail | null> {
  const [head] = await db
    .select({
      id: track.id,
      slug: track.slug,
      title: track.title,
      summary: track.summary,
      state: track.state,
      position: track.position,
      publishedAt: track.publishedAt,
    })
    .from(track)
    .where(eq(track.id, id))
    .limit(1);
  if (!head) return null;

  const tasks = await db
    .select({
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      mode: task.mode,
      points: task.points,
      state: task.state,
      position: task.position,
      publishedAt: task.publishedAt,
    })
    .from(task)
    .where(eq(task.trackId, id))
    .orderBy(asc(task.position));

  return { ...head, tasks };
}

// ---------------------------------------------------------------- Content

/**
 * Authoring the unified content entity (§33) — the pieces the Feed / home renders
 * (§3). Same shape as the Track/Task writes above: the `published_at` biconditional
 * is honoured on every state change, results are unions, and *who* may call is
 * enforced one layer up (§36) — track-scoped content by the Track's supervisor,
 * track-less content by an Admin.
 */

export type ContentType = "announcement" | "product" | "event" | "news" | "cultural" | "app_update";

/** The fields an author sets. `createdBy` is passed separately (from the session),
 * never the form. `null` clears an optional column; `undefined` leaves it. */
export type ContentInput = {
  type: ContentType;
  title: string;
  body: string;
  source?: string | null;
  trackId?: string | null;
  /** §32 — the برنامج/هيئة this general content speaks for, when any. */
  bodyId?: string | null;
  classification?: string | null;
  minTier?: string | null;
  taskId?: string | null;
  mediaKey?: string | null;
  linkUrl?: string | null;
  eventAt?: Date | null;
  eventPlace?: string | null;
};

export type CreateContentResult =
  | { status: "created"; id: string }
  | { status: "invalid" }
  | { status: "track-not-found" }
  | { status: "task-not-found" };

/**
 * Confirm the optional Track and Task a piece of content points at actually exist,
 * so a bad id becomes a clean status rather than a raw foreign-key error. Runs
 * inside the caller's transaction.
 */
async function contentRefsExist(
  tx: Queryable,
  trackId: string | null | undefined,
  taskId: string | null | undefined,
): Promise<"ok" | "track-not-found" | "task-not-found"> {
  if (trackId) {
    const [t] = await tx.select({ id: track.id }).from(track).where(eq(track.id, trackId)).limit(1);
    if (!t) return "track-not-found";
  }
  if (taskId) {
    const [t] = await tx.select({ id: task.id }).from(task).where(eq(task.id, taskId)).limit(1);
    if (!t) return "task-not-found";
  }
  return "ok";
}

export async function createContentItem(
  db: Database,
  input: ContentInput & { createdBy: string },
  at: Date = new Date(),
): Promise<CreateContentResult> {
  if (input.title.trim() === "" || input.body.trim() === "") return { status: "invalid" };

  return db.transaction(async (tx) => {
    const refs = await contentRefsExist(tx, input.trackId, input.taskId);
    if (refs !== "ok") return { status: refs };

    const [inserted] = await tx
      .insert(contentItem)
      .values({
        type: input.type,
        title: input.title,
        body: input.body,
        source: input.source ?? null,
        trackId: input.trackId ?? null,
        bodyId: input.bodyId ?? null,
        classification: input.classification ?? null,
        minTier: input.minTier ?? null,
        taskId: input.taskId ?? null,
        mediaKey: input.mediaKey ?? null,
        linkUrl: input.linkUrl ?? null,
        eventAt: input.eventAt ?? null,
        eventPlace: input.eventPlace ?? null,
        state: "draft",
        createdBy: input.createdBy,
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: contentItem.id });
    if (!inserted) throw new Error("content insert returned no row");
    return { status: "created", id: inserted.id };
  });
}

export type UpdateContentResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "invalid" }
  | { status: "track-not-found" }
  | { status: "task-not-found" };

export async function updateContentItem(
  db: Database,
  id: string,
  input: Partial<ContentInput>,
  at: Date = new Date(),
): Promise<UpdateContentResult> {
  if (input.title !== undefined && input.title.trim() === "") return { status: "invalid" };
  if (input.body !== undefined && input.body.trim() === "") return { status: "invalid" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: contentItem.id })
      .from(contentItem)
      .where(eq(contentItem.id, id))
      .limit(1);
    if (!existing) return { status: "not-found" };

    const refs = await contentRefsExist(tx, input.trackId, input.taskId);
    if (refs !== "ok") return { status: refs };

    await tx
      .update(contentItem)
      .set({
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.trackId !== undefined ? { trackId: input.trackId } : {}),
        ...(input.bodyId !== undefined ? { bodyId: input.bodyId } : {}),
        ...(input.classification !== undefined ? { classification: input.classification } : {}),
        ...(input.minTier !== undefined ? { minTier: input.minTier } : {}),
        ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
        ...(input.mediaKey !== undefined ? { mediaKey: input.mediaKey } : {}),
        ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
        ...(input.eventAt !== undefined ? { eventAt: input.eventAt } : {}),
        ...(input.eventPlace !== undefined ? { eventPlace: input.eventPlace } : {}),
        updatedAt: at,
      })
      .where(eq(contentItem.id, id));
    return { status: "updated" };
  });
}

/**
 * Move a content piece between states, keeping the `published_at` invariant exactly
 * as `setTrackState` does: publishing stamps the date (or keeps the one it had, so
 * re-publishing never rewrites history), archiving/unpublishing clears it. Returns
 * false for a missing item.
 */
async function setContentState(
  db: Database,
  id: string,
  state: "published" | "archived" | "draft",
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        publishedAt: contentItem.publishedAt,
        state: contentItem.state,
        title: contentItem.title,
        trackId: contentItem.trackId,
        taskId: contentItem.taskId,
      })
      .from(contentItem)
      .where(eq(contentItem.id, id))
      .limit(1);
    if (!row) return false;
    const publishedAt = state === "published" ? (row.publishedAt ?? at) : null;
    await tx
      .update(contentItem)
      .set({ state, publishedAt, updatedAt: at })
      .where(eq(contentItem.id, id));

    /**
     * Publishing something onto a Track is §38's «تحديث مهم لمسار يتابعه المستخدم».
     * Only on the *transition* into published, and only when the piece belongs to a
     * Track: re-publishing an already-live piece is not news, and track-less general
     * content follows nobody. In the same transaction, so the notice and the
     * publication are one fact.
     */
    if (state === "published" && row.state !== "published" && row.trackId) {
      await emitTrackUpdate(
        tx,
        { trackId: row.trackId, title: row.title, body: "جديد في المسار.", taskId: row.taskId },
        at,
      );
    }
    return true;
  });
}

export async function publishContentItem(db: Database, id: string, at: Date = new Date()) {
  return (await setContentState(db, id, "published", at))
    ? ({ status: "published" } as const)
    : ({ status: "not-found" } as const);
}
export async function archiveContentItem(db: Database, id: string, at: Date = new Date()) {
  return (await setContentState(db, id, "archived", at))
    ? ({ status: "archived" } as const)
    : ({ status: "not-found" } as const);
}
export async function unpublishContentItem(db: Database, id: string, at: Date = new Date()) {
  return (await setContentState(db, id, "draft", at))
    ? ({ status: "unpublished" } as const)
    : ({ status: "not-found" } as const);
}

/**
 * Delete a content piece. Unlike a Task, content carries no Point awards (the ledger
 * references Tasks, not content), so there is nothing to protect — a plain delete,
 * guarded only for a clean not-found.
 */
export async function deleteContentItem(
  db: Database,
  id: string,
): Promise<{ status: "deleted" } | { status: "not-found" }> {
  const deleted = await db
    .delete(contentItem)
    .where(eq(contentItem.id, id))
    .returning({ id: contentItem.id });
  return deleted.length > 0 ? { status: "deleted" } : { status: "not-found" };
}

/**
 * The Track a content piece belongs to — so a content action can gate on scope. The
 * outer `null` means the piece does not exist; an inner `trackId: null` means it is
 * track-less (general Faseela content), which the gate treats as admin-only.
 */
export async function contentTrackId(
  db: Database,
  id: string,
): Promise<{ trackId: string | null } | null> {
  const [row] = await db
    .select({ trackId: contentItem.trackId })
    .from(contentItem)
    .where(eq(contentItem.id, id))
    .limit(1);
  return row ? { trackId: row.trackId } : null;
}

export type AdminContentRow = {
  id: string;
  type: ContentType;
  title: string;
  state: "draft" | "published" | "archived";
  trackId: string | null;
  trackTitle: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

/**
 * Every content piece, whatever its state, newest first — the authoring list. Scoped
 * to one supervisor's Tracks when `supervisorId` is given (§35): the `exists` filter
 * on `track_id` naturally drops track-less content, which only an Admin may manage.
 */
export async function adminContentItems(
  db: Database,
  opts?: { supervisorId?: string },
): Promise<AdminContentRow[]> {
  const base = db
    .select({
      id: contentItem.id,
      type: contentItem.type,
      title: contentItem.title,
      state: contentItem.state,
      trackId: contentItem.trackId,
      trackTitle: track.title,
      publishedAt: contentItem.publishedAt,
      updatedAt: contentItem.updatedAt,
    })
    .from(contentItem)
    .leftJoin(track, eq(track.id, contentItem.trackId))
    .$dynamic();

  const scoped = opts?.supervisorId
    ? base.where(
        sql`exists (select 1 from ${trackSupervisor} ts where ts.track_id = ${contentItem.trackId} and ts.user_id = ${opts.supervisorId})`,
      )
    : base;

  return scoped.orderBy(desc(contentItem.updatedAt));
}

/** One content piece with every field — the authoring detail view. */
export async function adminContentItem(db: Database, id: string) {
  const [row] = await db.select().from(contentItem).where(eq(contentItem.id, id)).limit(1);
  return row ?? null;
}
