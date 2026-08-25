import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { Database } from "./client";
import { serviceRequest } from "./service";

/**
 * Contacting Faseela (spec §37) — «إرسال اقتراح · استفسار · ملاحظة · أمر يتعلق
 * بالتطبيق». Intake plus the admin triage reads.
 *
 * `createServiceRequest` is the application's **only unauthenticated write**, so
 * every guard against abuse lives here rather than in the form: the field caps and
 * the per-origin rate limit are part of the operation, not of one caller's UI, and a
 * second caller (a mobile endpoint) inherits them by construction.
 */

export type ServiceRequestType = "suggestion" | "inquiry" | "note" | "app_issue";
export type ServiceRequestStatus = "new" | "in_progress" | "handled" | "archived";

/**
 * The allowed values, as data. A Server Action's arguments arrive as untrusted JSON
 * and TypeScript is erased by then, so the union types above prove nothing at
 * runtime: without these lists an arbitrary string reaches the Postgres enum cast and
 * throws a 500 instead of returning a clean `invalid`.
 */
const TYPES: readonly ServiceRequestType[] = ["suggestion", "inquiry", "note", "app_issue"];
const STATUSES: readonly ServiceRequestStatus[] = ["new", "in_progress", "handled", "archived"];

/**
 * Field ceilings, exported so the form can show the same limits it will be held to
 * rather than hardcoding its own copy. A contact form with no upper bound is a free
 * write to our database for anyone on the internet; these are generous for a human
 * writing a note and meaningless to someone pasting a megabyte.
 */
export const SERVICE_REQUEST_MAX = { name: 100, email: 200, phone: 40, body: 4000 } as const;

/** How many requests one origin may send per hour before we stop listening. */
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const;

/**
 * The bucket for a sender whose origin we could not determine. Requests without a
 * hash are counted **together** rather than exempted: an exemption would make
 * "send no forwarding header" the cheapest bypass in the system. On a real deploy the
 * platform always sets one, so sharing this bucket costs nothing; locally it means
 * the whole machine shares one allowance.
 */
const UNKNOWN_ORIGIN = "unknown-origin";

/** Reject anything that is not a plain string before we start trimming it. */
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export type ServiceRequestInput = {
  requestType: ServiceRequestType;
  name: string;
  body: string;
  email?: string | null;
  phone?: string | null;
  /** Set when the sender happened to be signed in (§37 admits both الزائر والمستخدم). */
  userId?: string | null;
  /** A salted hash of the sender's IP — never the address. Absent = unmeasurable origin. */
  ipHash?: string | null;
};

export type CreateServiceRequestResult =
  | { status: "created"; id: string }
  | { status: "invalid" }
  | { status: "rate-limited" };

export async function createServiceRequest(
  db: Database,
  input: ServiceRequestInput,
  at: Date = new Date(),
): Promise<CreateServiceRequestResult> {
  /**
   * Everything below treats `input` as untrusted. It arrives from an anonymous
   * caller, so a field may be missing, the wrong type, or a value no enum admits —
   * each of which must come back as `invalid`, never as a thrown 500.
   */
  if (!TYPES.includes(input.requestType)) return { status: "invalid" };

  const rawName = asString(input.name);
  const rawBody = asString(input.body);
  if (rawName === null || rawBody === null) return { status: "invalid" };

  const name = rawName.trim();
  const body = rawBody.trim();
  const email = asString(input.email)?.trim() || null;
  const phone = asString(input.phone)?.trim() || null;
  const userId = asString(input.userId) ?? null;

  if (name === "" || body === "") return { status: "invalid" };
  if (
    name.length > SERVICE_REQUEST_MAX.name ||
    body.length > SERVICE_REQUEST_MAX.body ||
    (email !== null && email.length > SERVICE_REQUEST_MAX.email) ||
    (phone !== null && phone.length > SERVICE_REQUEST_MAX.phone)
  ) {
    return { status: "invalid" };
  }
  /** Mirrors the `service_request_has_contact` CHECK, as a clean status rather than
   * a raw constraint violation: there must be some way to answer. */
  if (email === null && phone === null && userId === null) return { status: "invalid" };

  const origin = asString(input.ipHash) || UNKNOWN_ORIGIN;
  const since = new Date(at.getTime() - RATE_LIMIT.windowMs);

  /**
   * Count and insert in one transaction, behind a lock on the origin itself.
   *
   * The count reads the table rather than any in-memory counter, because the app runs
   * as serverless functions — a tally in one instance's memory tells the next
   * instance nothing. But a bare count-then-insert is a race: fire twenty requests at
   * once and all twenty read a count of zero before any of them writes. The advisory
   * lock is held for the transaction and keyed on the origin, so requests from the
   * *same* sender queue behind each other while everyone else proceeds untouched.
   */
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${origin}))`);

    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceRequest)
      .where(and(eq(serviceRequest.ipHash, origin), gte(serviceRequest.createdAt, since)));
    if (Number(recent?.count ?? 0) >= RATE_LIMIT.max) {
      return { status: "rate-limited" as const };
    }

    const [inserted] = await tx
      .insert(serviceRequest)
      .values({
        requestType: input.requestType,
        name,
        body,
        email,
        phone,
        userId,
        ipHash: origin,
        status: "new",
        createdAt: at,
        updatedAt: at,
      })
      .returning({ id: serviceRequest.id });
    if (!inserted) throw new Error("service request insert returned no row");
    return { status: "created" as const, id: inserted.id };
  });
}

// ------------------------------------------------------------------ Triage

export type AdminServiceRequest = {
  id: string;
  requestType: ServiceRequestType;
  name: string;
  email: string | null;
  phone: string | null;
  body: string;
  status: ServiceRequestStatus;
  userId: string | null;
  handledBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The triage list, newest first — the order someone working a queue wants, since an
 * unanswered message matters more the fresher it is. Narrowed to one status when
 * given. `ip_hash` is deliberately not selected: it exists to count against, not to
 * be shown to anyone.
 */
export async function adminServiceRequests(
  db: Database,
  opts?: { status?: ServiceRequestStatus; limit?: number },
): Promise<AdminServiceRequest[]> {
  const base = db
    .select({
      id: serviceRequest.id,
      requestType: serviceRequest.requestType,
      name: serviceRequest.name,
      email: serviceRequest.email,
      phone: serviceRequest.phone,
      body: serviceRequest.body,
      status: serviceRequest.status,
      userId: serviceRequest.userId,
      handledBy: serviceRequest.handledBy,
      createdAt: serviceRequest.createdAt,
      updatedAt: serviceRequest.updatedAt,
    })
    .from(serviceRequest)
    .$dynamic();

  const scoped = opts?.status ? base.where(eq(serviceRequest.status, opts.status)) : base;
  /** Bounded by default: the public can grow this table, so an unbounded select is a
   * page that gets slower the more spam it receives. */
  return scoped.orderBy(desc(serviceRequest.createdAt)).limit(opts?.limit ?? 200);
}

export type UpdateServiceRequestStatusResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "invalid" };

/**
 * Move a request through triage, recording the staff member who took it on. Who may
 * call this is enforced one layer up, in the `/idara` gate (§36) — this module is the
 * mechanism, not the authority. `at` stays last, as everywhere else in this package.
 */
export async function updateServiceRequestStatus(
  db: Database,
  id: string,
  input: { status: ServiceRequestStatus; handledBy?: string },
  at: Date = new Date(),
): Promise<UpdateServiceRequestStatusResult> {
  /** The status arrives from a form too, so it is checked like any other input. */
  if (!STATUSES.includes(input.status)) return { status: "invalid" };

  const updated = await db
    .update(serviceRequest)
    .set({
      status: input.status,
      ...(input.handledBy !== undefined ? { handledBy: input.handledBy } : {}),
      updatedAt: at,
    })
    .where(eq(serviceRequest.id, id))
    .returning({ id: serviceRequest.id });
  return updated.length > 0 ? { status: "updated" } : { status: "not-found" };
}
