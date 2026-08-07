import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { task, submission } from "./content";
import { user } from "./identity";

/**
 * Seasons and the Point ledger.
 *
 * CONTEXT.md: a Point is "the unit of earned cultural effort, minted only by an
 * accepted Submission. Never spent, never transferred — Points are a record,
 * not a currency." That sentence is the reason this is an append-only ledger of
 * awards rather than a running total on the member row: a total is a derived
 * value, and storing a derived value as the source of truth is how balances
 * drift irrecoverably. See ADR 0015.
 */

export const season = pgTable(
  "season",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("season_starts_at_idx").on(t.startsAt),
    check("season_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const pointAward = pgTable(
  "point_award",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * `restrict`, deliberately unlike the cascade on `session` and `account`.
     * Those hold credentials and are worthless once the person is gone; this
     * holds the record that a Member did the work, and past Seasons'
     * Leaderboards must not silently reorder because an account was closed.
     *
     * Erasure is honoured by anonymising the `user` row (see
     * `anonymiseMember` in ./members.ts), not by deleting it. RESTRICT is what
     * makes that the only available path: an accidental `DELETE FROM "user"`
     * now raises rather than quietly destroying the ledger. See ADR 0016.
     */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /**
     * Which Season this award counts toward, resolved once at award time from
     * the Season containing `awardedAt`. Denormalised deliberately: recomputing
     * it from timestamps would silently rewrite history the moment an Editor
     * corrects a Season's dates, and CONTEXT.md says Points earned in one
     * Season never carry into the next.
     */
    seasonId: uuid("season_id")
      .notNull()
      .references(() => season.id, { onDelete: "restrict" }),
    /**
     * `restrict`, not `cascade`: deleting a Task must not erase the record that
     * a Member did the work. If a Task has awards it cannot be deleted, only
     * archived.
     */
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "restrict" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submission.id, { onDelete: "restrict" }),
    /**
     * Copied from `task.points` at award time, never read through the join.
     * An Editor raising a Task from 5 to 10 points must not retroactively
     * change what earlier Members earned, and a Leaderboard that silently
     * reorders itself because someone edited a Task is not a record of effort.
     */
    points: integer("points").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * The idempotency guarantee. One accepted Submission mints exactly one
     * award, enforced by the database rather than by remembering to check —
     * a retried request, a double-clicked accept button, or two Editors
     * accepting at once all collapse to one row.
     */
    uniqueIndex("point_award_submission_unique").on(t.submissionId),
    /** Covers the Leaderboard aggregate: sum(points) per user within a season. */
    index("point_award_season_user_idx").on(t.seasonId, t.userId),
    index("point_award_user_awarded_idx").on(t.userId, t.awardedAt),
    check("point_award_points_positive", sql`${t.points} > 0`),
  ],
);

export const seasonRelations = relations(season, ({ many }) => ({
  awards: many(pointAward, { relationName: "pointAward_seasonId" }),
}));

export const pointAwardRelations = relations(pointAward, ({ one }) => ({
  member: one(user, {
    fields: [pointAward.userId],
    references: [user.id],
    relationName: "pointAward_userId",
  }),
  season: one(season, {
    fields: [pointAward.seasonId],
    references: [season.id],
    relationName: "pointAward_seasonId",
  }),
  task: one(task, {
    fields: [pointAward.taskId],
    references: [task.id],
    relationName: "pointAward_taskId",
  }),
  submission: one(submission, {
    fields: [pointAward.submissionId],
    references: [submission.id],
    relationName: "pointAward_submissionId",
  }),
}));
