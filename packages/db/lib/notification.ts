import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { publishState, task, track } from "./content";
import { user } from "./identity";

/**
 * Notifications (spec §38) — «إشعارات مرتبطة بالأحداث المهمة».
 *
 * Most of §38's list is **per-member and event-driven**: your work was accepted,
 * returned or rejected; your points were credited; a new capability opened. The rest
 * are initiative-wide broadcasts an admin writes (an app update, an important
 * announcement or event). Both live here, told apart by whether `user_id` is set.
 *
 * Deliberately its own table rather than another `content_item` type (ADR 0026 made
 * content one entity because every type is the same public, stateless feed card). A
 * notification is none of those things: it is addressed to someone, it carries
 * per-reader seen state, and it drives a badge. Same data, different behaviour —
 * different table. The two connect through the link a notification points at.
 *
 * §38 is equally clear about what *not* to do: «لا يجب تحويل كل تحديث صغير إلى إشعار».
 * The enum below is therefore the whole list of reasons we may interrupt someone, and
 * adding to it should feel like a decision.
 */
export const notificationType = pgEnum("notification_type", [
  /** An Editor accepted the Member's submitted work (§25). */
  "submission_accepted",
  /** Returned for revision — the Member can submit again (§24). */
  "submission_returned",
  /** Finally rejected (§25). */
  "submission_rejected",
  /** Points were credited to the ledger — «اعتماد النقاط». */
  "points_awarded",
  /** The Member crossed a tier threshold — «فتح صلاحية جديدة» (§45–49). */
  "tier_unlocked",
  /** An important update to a Track the Member follows. */
  "track_update",
  /** A platform change worth surfacing — «تحديث مهم في التطبيق». */
  "app_update",
  /** An announcement or event the initiative wants seen. */
  "announcement",
]);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: notificationType("type").notNull(),
    /**
     * Who it is for — **null means everyone**. A per-member event names its Member;
     * a broadcast names no one and is read by all. This single nullable column is
     * what lets one table serve both of §38's halves without a second entity.
     */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** What it points at, so tapping a notification lands somewhere useful. */
    trackId: uuid("track_id").references(() => track.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => task.id, { onDelete: "set null" }),
    linkUrl: text("link_url"),
    /**
     * Reuses the publish lifecycle Tracks, Tasks and content already share. An
     * event notification is inserted already `published` — the event has happened,
     * there is nothing to draft — while a broadcast is written, then published.
     */
    state: publishState("state").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /**
     * The admin who wrote it. Null for an event the system raised on its own — no
     * person authored "your work was accepted". No `onDelete`: an author who
     * published is anonymised, never dropped (ADR 0016).
     */
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The member read and the badge count: what is addressed to me, newest first. */
    index("notification_user_published_idx").on(t.userId, t.publishedAt),
    /** The broadcast read and the admin list. */
    index("notification_state_published_idx").on(t.state, t.publishedAt),
    /** The same publish invariant every publishable row in this schema carries. */
    check(
      "notification_published_has_date",
      sql`(${t.state} = 'published') = (${t.publishedAt} is not null)`,
    ),
  ],
);
