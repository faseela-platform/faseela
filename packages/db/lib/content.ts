import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { user } from "./identity";

/**
 * Tracks, Tasks and the things Members send in. Vocabulary is CONTEXT.md's:
 * Track (مسار), Task (مهمة), Submission, Review, Point (نقطة).
 */

export const publishState = pgEnum("publish_state", ["draft", "published", "archived"]);

/**
 * How a Task's completion is established. G4=C: objectively checkable Tasks
 * mint on the Member's own action, creative output waits for a human.
 *
 * `attest`  — the Member declares they read/watched/attended it. Mints at once.
 * `review`  — the Member submits work an Editor must accept. Mints on accept.
 *
 * This is an enum rather than a boolean because a third mode is foreseeable
 * (a quiz that marks itself), and widening an enum is cheaper than migrating
 * a boolean into one.
 */
export const completionMode = pgEnum("completion_mode", ["attest", "review"]);

/**
 * The lifecycle state of a Member's Submission for one Task (§22). `draft` and
 * `cancelled` are appended (not reordered) so the migration is a plain
 * `ALTER TYPE … ADD VALUE` rather than an enum rebuild.
 *
 * `draft`     — started, auto-saving, not yet submitted (§21).
 * `pending`   — submitted, waiting in the review queue (§22 under-review).
 * `accepted`  — an Editor accepted it; Points minted.
 * `rejected`  — an Editor finally rejected it (terminal, §25).
 * `returned`  — sent back for revision; the Member may submit again (§24).
 * `cancelled` — the Member closed the draft; NOT a rejection (§21).
 */
export const submissionState = pgEnum("submission_state", [
  "pending",
  "accepted",
  "rejected",
  "returned",
  "draft",
  "cancelled",
]);

/**
 * An Editor's verdict on one attempt, recorded immutably in the attempt log
 * (§25/§26). Distinct from `submission_state`: the state is the Submission's
 * current position; a decision is what happened to a specific attempt.
 */
export const reviewDecision = pgEnum("review_decision", ["accepted", "returned", "rejected"]);

/**
 * The kind of a content piece (§33). One `content_item` entity carries them all,
 * discriminated by this type, rather than a table each — §33 defines a single
 * content model identified *by* its type, and the Feed (§3) is one merged stream,
 * so a union of separate tables would be the wrong shape. Kept tight: a
 * `track_launch` is an `announcement`, cultural scene (§3.4) is `cultural`.
 *
 * `announcement` — a short, time-bound notice pointing at an Event or Track (إعلان).
 * `product`      — a finished cultural artefact under a Track (منتج).
 * `event`        — a gathering with a time and place (فعالية); uses `event_at`/`event_place`.
 * `news`         — initiative news (أخبار المبادرة / برامج التأهيل / هيئات الإنتاج).
 * `cultural`     — the wider cultural scene (§3.4): material with no home Track.
 * `app_update`   — a platform change worth surfacing (تحديثات التطبيق).
 */
export const contentType = pgEnum("content_type", [
  "announcement",
  "product",
  "event",
  "news",
  "cultural",
  "app_update",
]);

export const track = pgTable(
  "track",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL segment. Latin-only by policy: Arabic slugs percent-encode into unreadable URLs. */
    slug: text("slug").notNull().unique(),
    /** Arabic is the source language of the domain, so the plain column is Arabic. */
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    state: publishState("state").notNull().default("draft"),
    /** Display order within the Tracks index. Editors reorder; not chronological. */
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("track_state_position_idx").on(t.state, t.position),
    /**
     * A published Track must have a publish date; a draft must not. Enforced in
     * the database because it is the kind of invariant that decays when three
     * different code paths can publish.
     */
    check(
      "track_published_has_date",
      sql`(${t.state} = 'published') = (${t.publishedAt} is not null)`,
    ),
  ],
);

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** What the Member is asked to do, in Arabic. */
    instructions: text("instructions").notNull(),
    mode: completionMode("mode").notNull(),
    /**
     * Points are minted at this value. Stored on the Task, and copied onto the
     * ledger entry when awarded — see ADR 0015. Changing a Task's worth must
     * never retroactively change what past Members earned.
     */
    points: integer("points").notNull(),
    /**
     * §19 فلتر المحتوى المرتبط بالمهمة — what the Member may choose the Task's
     * content from: null = the Task is about no content (today's Tasks); the
     * literal "track" = any published content of its Track; any other value = a
     * classification within the Track («كتاب», «مقال», …). The simplest honest
     * form of §19's three scopes — an explicit id-list can arrive later without
     * disturbing these two.
     */
    contentScope: text("content_scope"),
    state: publishState("state").notNull().default("draft"),
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("task_track_id_position_idx").on(t.trackId, t.position),
    check("task_points_positive", sql`${t.points} > 0`),
    check(
      "task_published_has_date",
      sql`(${t.state} = 'published') = (${t.publishedAt} is not null)`,
    ),
  ],
);

export const submission = pgTable(
  "submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    /**
     * References Better Auth's `user` directly rather than a separate Member
     * table. A Member *is* a user with progress; a second table would add a
     * join to every query for no behaviour. See ADR 0014.
     */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null for `attest` Tasks: there is nothing to send, only a declaration. */
    body: text("body"),
    /** R2 object key, not a URL: URLs change, keys do not. */
    mediaKey: text("media_key"),
    /**
     * §42 المحتوى المختار — the content this work is ABOUT (§15's chosen book),
     * when the Task carries a `contentScope`. Set null on content delete: the
     * work and its review survive; only the pointer is lost.
     */
    contentId: uuid("content_id").references((): AnyPgColumn => contentItem.id, {
      onDelete: "set null",
    }),
    state: submissionState("state").notNull().default("pending"),
    /** An Editor's note back to the Member on reject or return. */
    reviewNote: text("review_note"),
    /**
     * The Editor (a `user` with a staff role) who last reviewed this Submission.
     * A real foreign key now that Payload is gone and editors are our own users
     * (ADR 0023): reviewer and Member live in the same schema, so the database
     * itself guarantees a reviewer id names a real person. No `onDelete` — a
     * reviewer who has judged work cannot be dropped out from under the review;
     * staff are anonymised, never hard-deleted, the same as Members (ADR 0016).
     */
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * One Submission per Member per Task. This is the constraint that stops
     * double-minting, and it lives in the database because a uniqueness check
     * in application code is a race, not a guarantee: two concurrent requests
     * both read "no submission yet" before either writes.
     */
    uniqueIndex("submission_task_user_unique").on(t.taskId, t.userId),
    /** The review queue: pending, oldest first. */
    index("submission_state_created_idx").on(t.state, t.createdAt),
    index("submission_user_id_idx").on(t.userId),
    check(
      "submission_reviewed_together",
      sql`(${t.reviewedAt} is null) = (${t.reviewedBy} is null)`,
    ),
  ],
);

/**
 * The immutable log of a Submission's attempts (§26: attempts are never
 * overwritten; §24: an Editor sees previous attempts and previous notes).
 *
 * The `submission` row holds the *current* state; each row here is one try,
 * frozen at submit time — its `body`/`media_key` are a snapshot, so a later
 * resubmission after a return does not erase what was reviewed before. An
 * Editor's verdict is stamped back onto the attempt it judged.
 */
export const submissionAttempt = pgTable(
  "submission_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submission.id, { onDelete: "cascade" }),
    /** 1-based sequence within a Submission, for display order (§24). */
    attemptNo: integer("attempt_no").notNull(),
    /** Snapshot of the answer at this attempt — immutable once written. */
    body: text("body"),
    /** Snapshot R2 key for this attempt's file; null if none. */
    mediaKey: text("media_key"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    /** The Editor's verdict; null until this attempt is reviewed. */
    decision: reviewDecision("decision"),
    /** The note to the Member on a return or reject (§24). */
    reviewNote: text("review_note"),
    /** The graded value on accept (§25), ≤ the Task's points; null otherwise. */
    earnedPoints: integer("earned_points"),
    /** The reviewing Editor (a `user`); a real FK, as on `submission.reviewed_by`. */
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** One row per attempt number within a Submission. */
    uniqueIndex("submission_attempt_no_unique").on(t.submissionId, t.attemptNo),
    /** The history read: all attempts of one Submission. */
    index("submission_attempt_submission_idx").on(t.submissionId),
    /**
     * A reviewed attempt carries decision, reviewer and time together — the same
     * all-or-nothing rule the Submission row uses, so a half-recorded review
     * cannot exist.
     */
    check(
      "attempt_reviewed_together",
      sql`(${t.decision} is null) = (${t.reviewedAt} is null) and (${t.decision} is null) = (${t.reviewedBy} is null)`,
    ),
    /**
     * Points are earned only on acceptance, and only as a positive value. The
     * upper bound (≤ the Task's points) needs the Task row, so it is enforced in
     * `acceptSubmission`, not here.
     */
    check(
      "attempt_earned_only_on_accept",
      sql`${t.earnedPoints} is null or (${t.decision} = 'accepted' and ${t.earnedPoints} > 0)`,
    ),
  ],
);

/**
 * Who supervises which Track (spec §35). A supervisor is an Editor the central
 * admin has assigned to a Track; they may manage that Track — its Tasks and its
 * Submissions — and no other, unless assigned more. This is *scope*, layered on
 * top of the `user.role` staff flag: `admin` is global and needs no row here;
 * an `editor` manages exactly the Tracks they appear against.
 *
 * A join table, not a column, because §35 allows several supervisors per Track
 * and a supervisor may hold several Tracks — a many-to-many the role enum cannot
 * express. Assignment is a deliberate admin act (§35: never granted by Points).
 */
/**
 * متابعة المسار (§10) — the explicit follow relation, R3 (Slices 12+13). Until now
 * notifications *guessed* a Member's Tracks from where they had worked
 * (`notification-emit.ts`'s implicit follow, self-documented as a stand-in); this
 * table is the real thing: the home's zone 2 (§3), the followed-first Tracks page
 * (§9), the follow button and follower count (§11) all read from here.
 *
 * Mirrors `track_supervisor`'s shape deliberately: a join table (a Member follows
 * many Tracks, a Track has many followers), unique per pair so a double-tap is a
 * no-op, cascade both ways — a follow is pure interest, and interest is exactly
 * what a removed account or Track should lose. The migration backfills a follow
 * for every (Member, Track) the Member has already worked in (owner decision
 * 2026-09-01: continuity with the implicit-follow notifications).
 */
export const trackFollow = pgTable(
  "track_follow",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("track_follow_unique").on(t.trackId, t.userId),
    /** The Member's followed list (§9, zone 2). */
    index("track_follow_user_idx").on(t.userId),
    /** The Track's follower count (§11). */
    index("track_follow_track_idx").on(t.trackId),
  ],
);

/**
 * برامج التأهيل وهيئات الإنتاج (§2) — the initiative's non-Track bodies. The spec
 * is emphatic that they are NOT Tracks («ليست مسارات ولا تحتوي على نظام مهام»):
 * only their أخبار and productions appear on the home (§32). A small named table
 * (owner decision 2026-09-01) rather than free text, so a news item can say WHICH
 * body it speaks for and the home can label and later filter by it; rather than an
 * enum, so the initiative can add a body without a migration.
 */
export const bodyKind = pgEnum("body_kind", ["program", "production_body"]);

export const initiativeBody = pgTable(
  "body",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Arabic display name — «المعهد التدريبي», «دار فسيلة», … */
    name: text("name").notNull().unique(),
    kind: bodyKind("kind").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("body_kind_position_idx").on(t.kind, t.position)],
);

export const trackSupervisor = pgTable(
  "track_supervisor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    /** The Editor. Cascade like `session`/`account`: an assignment is pure access,
     * and access is exactly what a removed account should lose. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** One assignment per (Track, Editor) — assigning twice is a no-op, not a duplicate. */
    uniqueIndex("track_supervisor_unique").on(t.trackId, t.userId),
    /** The scope read: which Tracks does this Editor supervise. */
    index("track_supervisor_user_idx").on(t.userId),
  ],
);

/**
 * A piece of published content (§33) — the unified model behind the Feed / home
 * page (§3). One entity for every kind (Announcement, Product, Event, News, the
 * cultural scene, app updates), discriminated by `type`, because §33 defines a
 * single content model identified by its type, source, Track (if any),
 * classification, availability, task-link, dates, state and creator.
 *
 * Deliberately mirrors `track`/`task`: the same `publish_state`, the same
 * `published_at` biconditional, so publishing content behaves exactly as
 * publishing a Track does. Content may be track-less (§33: "content can be
 * track-less if it is general Faseela content"), which is why `track_id` is
 * nullable — and track-less authoring is admin-only (no Track owner to scope to).
 */
export const contentItem = pgTable(
  "content_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: contentType("type").notNull(),
    /** Arabic is the source language of the domain, so the plain columns are Arabic. */
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** §33 المصدر — free text kept for anything the body table does not name. */
    source: text("source"),
    /**
     * §32 — which برنامج/هيئة this general content speaks for, when any. Set
     * null on body delete rather than cascading: the news outlives the body's
     * row, it just loses its label.
     */
    bodyId: uuid("body_id").references(() => initiativeBody.id, { onDelete: "set null" }),
    /** §33 المسار: content belongs to a Track, or is track-less general content. */
    trackId: uuid("track_id").references(() => track.id, { onDelete: "cascade" }),
    /** §33 التصنيف — an optional topic/category tag. */
    classification: text("classification"),
    /**
     * §33 درجة الإتاحة — the minimum Tier that may see this, by tier key; null = public.
     * Modeled now (the field the spec requires) but not yet *enforced*: the first
     * content is public, and the `requireTier` seam held since Slice 3 is built when
     * special/level content (§43) actually exists. No FK to `member_tier` — a tier
     * key is a stable identifier and content must not block on a threshold row.
     */
    minTier: text("min_tier"),
    /** §33 ارتباطها بمهمة — an optional Task this content relates to. */
    taskId: uuid("task_id").references(() => task.id, { onDelete: "set null" }),
    /** Optional R2 object key for an image/poster; rendered via a presigned GET. */
    mediaKey: text("media_key"),
    /** Optional outbound link — Channels are links, never ingested (ADR 0013). */
    linkUrl: text("link_url"),
    /** For `event` content: when and where (حضوري/مجازي). Both optional. */
    eventAt: timestamp("event_at", { withTimezone: true }),
    eventPlace: text("event_place"),
    state: publishState("state").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /**
     * §33 الجهة التي أنشأتها — the authoring Editor/Admin (a `user`). A real FK, no
     * `onDelete`: an author who has published cannot be dropped out from under their
     * content; staff are anonymised, never hard-deleted (ADR 0016), the same as
     * `submission.reviewed_by`.
     */
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The Feed read: published, newest first. */
    index("content_item_feed_idx").on(t.state, t.publishedAt),
    /** A Track's own content (its Products/Events) — for the Track page later. */
    index("content_item_track_idx").on(t.trackId),
    index("content_item_type_idx").on(t.type),
    /** The same publish invariant as `track`/`task`: published ⇔ has a publish date. */
    check(
      "content_item_published_has_date",
      sql`(${t.state} = 'published') = (${t.publishedAt} is not null)`,
    ),
  ],
);

export const trackRelations = relations(track, ({ many }) => ({
  tasks: many(task, { relationName: "task_trackId" }),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  track: one(track, {
    fields: [task.trackId],
    references: [track.id],
    relationName: "task_trackId",
  }),
  submissions: many(submission, { relationName: "submission_taskId" }),
}));

export const submissionRelations = relations(submission, ({ one, many }) => ({
  task: one(task, {
    fields: [submission.taskId],
    references: [task.id],
    relationName: "submission_taskId",
  }),
  member: one(user, {
    fields: [submission.userId],
    references: [user.id],
    relationName: "submission_userId",
  }),
  /**
   * `reviewed_by` is a real FK into `user` now, but no `reviewer` relation is
   * declared: the review reads join to it explicitly (and pull only the reviewer's
   * name), which keeps `user` from needing a back-relation for every FK that
   * points at it. The join lives in `review.ts`, not here.
   */
  attempts: many(submissionAttempt, { relationName: "attempt_submissionId" }),
}));

export const submissionAttemptRelations = relations(submissionAttempt, ({ one }) => ({
  submission: one(submission, {
    fields: [submissionAttempt.submissionId],
    references: [submission.id],
    relationName: "attempt_submissionId",
  }),
}));
