import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./identity";

/**
 * Contacting Faseela (spec §37) — «طريق بسيط للتواصل مع الإدارة/المشرفين».
 *
 * A Service Request (طلب خدمة) is an inbound approach: a suggestion, an inquiry, a
 * note, or something about the app itself. §37 is explicit that v1 needs **no chat
 * system** — this is one-way intake with an admin triage list, not a thread.
 */

/**
 * What the sender is reaching out about (§37's four kinds). Kept exactly to the
 * spec's v1 list; the initiative's wider الخدمات kinds (volunteering, scholarly /
 * technical / media support) are a cheap `ALTER TYPE … ADD VALUE` away if those
 * pages are ever built — which is why this is an enum and not a boolean pair.
 */
export const serviceRequestType = pgEnum("service_request_type", [
  "suggestion",
  "inquiry",
  "note",
  "app_issue",
]);

/**
 * How far along the triage is. §37 does not specify a lifecycle — this is the
 * minimum an admin needs to work a list without losing track of what was answered,
 * and it mirrors the publish/submission state vocabulary used elsewhere.
 */
export const serviceRequestStatus = pgEnum("service_request_status", [
  "new",
  "in_progress",
  "handled",
  "archived",
]);

export const serviceRequest = pgTable(
  "service_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestType: serviceRequestType("request_type").notNull(),
    /** Whatever the sender called themselves — free text, in whatever script. */
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    /** What they wrote — the suggestion, question or note itself. */
    body: text("body").notNull(),
    status: serviceRequestStatus("status").notNull().default("new"),
    /**
     * The sender, when they happened to be signed in. §37 admits «الزائر والمستخدم»
     * — both — so this is nullable rather than required: a visitor with no account
     * is exactly who this form is for. `set null` on delete, not cascade: the message
     * is the initiative's record of what was asked, and it survives the account being
     * removed — only the link back to a person is dropped (ADR 0016's spirit).
     */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /**
     * The staff member who took it on. No `onDelete` — someone who handled a request
     * cannot be dropped out from under it; staff are anonymised, never hard-deleted
     * (ADR 0016), the same rule `submission.reviewed_by` follows.
     */
    handledBy: text("handled_by").references(() => user.id),
    /**
     * A salted hash of the sender's IP — **never the address itself**. This is the
     * only thing that makes rate limiting possible on an unauthenticated write, and
     * hashing keeps it from being a plain-text log of who visited: it can confirm
     * "this same origin again" without being reversible into an address.
     */
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The triage queue: by state, newest first. */
    index("service_request_status_created_idx").on(t.status, t.createdAt),
    /** The rate-limit read: how many from this origin, recently. */
    index("service_request_ip_created_idx").on(t.ipHash, t.createdAt),
    /**
     * A request must leave some way to answer it. An email, a phone number, or a
     * signed-in account — a member is already reachable through their own record, so
     * requiring a contact field from them would be asking for what we have.
     */
    check(
      "service_request_has_contact",
      sql`(${t.email} is not null) or (${t.phone} is not null) or (${t.userId} is not null)`,
    ),
  ],
);
