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

export const submissionState = pgEnum("submission_state", [
  "pending",
  "accepted",
  "rejected",
  "returned",
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
    state: submissionState("state").notNull().default("pending"),
    /** An Editor's note back to the Member on reject or return. */
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
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

export const submissionRelations = relations(submission, ({ one }) => ({
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
  reviewer: one(user, {
    fields: [submission.reviewedBy],
    references: [user.id],
    relationName: "submission_reviewedBy",
  }),
}));
