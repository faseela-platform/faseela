import { relations, sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Better Auth owns these four tables and their column names. Better Auth's
 * Drizzle adapter looks tables up by the exported property name, so `user`,
 * `session`, `account` and `verification` must stay singular and must not be
 * renamed. Regenerating with `npx auth@latest generate` will overwrite drift.
 *
 * Payload must never declare a collection that maps onto these table names —
 * see ADR 0014. `Member` is our own table and joins to `user` one-to-one.
 */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),

    /**
     * Present from the first migration although sign-in is email magic link
     * only (G5=C). Adding a nullable column later is cheap; adding a *unique*
     * one to a populated table is not, because existing rows must first be
     * proven non-conflicting. Declaring it now means enabling phone sign-in is
     * a config change rather than a migration against live member data.
     */
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),

    /**
     * Set when a Member exercises erasure. Non-null means the identifying
     * columns above have been scrubbed and the row survives only to keep the
     * Point ledger's foreign keys valid — see ADR 0016.
     *
     * A nullable timestamp rather than a boolean because "when" is the question
     * actually asked of this column later, by a retention policy or a regulator,
     * and a boolean cannot answer it. Nullable rather than defaulted because the
     * absence of a date is precisely the meaning of a live account.
     */
    anonymisedAt: timestamp("anonymised_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Partial unique index rather than a plain unique constraint: every
     * magic-link member has a null phone, and Postgres treats nulls as
     * distinct, so a plain unique would technically work — but a partial index
     * is smaller and states the intent, which is that a phone identifies at
     * most one member.
     */
    uniqueIndex("user_phone_number_unique")
      .on(t.phoneNumber)
      .where(sql`${t.phoneNumber} is not null`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * Relations exist so Better Auth's `experimental.joins` can resolve a session
 * and its user in one round trip. Neon is a network hop, which is exactly the
 * condition where that matters; the adapter documents 2-3x on `/get-session`.
 *
 * `relationName` is pinned on both sides of every pair. The adapter warns that
 * an unnamed pair cannot be inferred when a table has two foreign keys to the
 * same target, and pinning names now avoids a silent break if one is added.
 */
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session, { relationName: "session_userId" }),
  accounts: many(account, { relationName: "account_userId" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
    relationName: "session_userId",
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
    relationName: "account_userId",
  }),
}));
