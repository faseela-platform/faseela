import { desc, eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { account, session, user } from "./identity";
import { pointAward } from "./progress";

export type UserRole = "member" | "editor" | "admin";

/**
 * Whether a role is staff — allowed to review Submissions and reach the admin
 * surfaces. One definition, so "who counts as staff" is decided in a single place
 * rather than re-spelled at every gate (the review-mint guard, the route gate).
 */
export function isStaffRole(role: UserRole | null): boolean {
  return role === "editor" || role === "admin";
}

/**
 * A user's role, or null if there is no such user. The web layer's editor gate
 * reads this to decide whether a signed-in person may reach the review queue —
 * kept here rather than trusting a `role` claim off the session, so that revoking
 * someone's staff status takes effect on their next request, not their next login.
 */
export async function roleOfUser(db: Database, userId: string): Promise<UserRole | null> {
  const rows = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  return rows[0]?.role ?? null;
}

export type SetUserRoleResult = { status: "updated" } | { status: "no-such-user" };

/**
 * Confer or revoke a staff role on a user by id — the admin dashboard's version of
 * `scripts/set-role.mjs` (spec §34). A role is granted, never earned (ADR 0023); the
 * authority to call this is the admin gate, not this function.
 */
export async function setUserRole(
  db: Database,
  userId: string,
  role: UserRole,
  at: Date = new Date(),
): Promise<SetUserRoleResult> {
  const updated = await db
    .update(user)
    .set({ role, updatedAt: at })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return updated.length > 0 ? { status: "updated" } : { status: "no-such-user" };
}

export type AdminMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  points: number;
};

/**
 * Every member with their role and **lifetime** Points, richest first — the admin
 * member view (§34). Points are summed from the ledger, not stored (ADR 0015); the
 * tier is derived from `points` in the UI via the shared `tierForPoints`.
 */
export async function adminMemberList(db: Database): Promise<AdminMember[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: sql<number>`coalesce(sum(${pointAward.points}), 0)::int`,
    })
    .from(user)
    .leftJoin(pointAward, eq(pointAward.userId, user.id))
    .groupBy(user.id, user.name, user.email, user.role)
    .orderBy(desc(sql`coalesce(sum(${pointAward.points}), 0)`));
  return rows.map((r) => ({ ...r, points: Number(r.points) }));
}

export type AnonymiseResult =
  | { status: "anonymised"; at: Date }
  | { status: "already-anonymised"; at: Date }
  | { status: "no-such-member" };

/**
 * The identity a Member supplies at account creation (spec §5): a full name and
 * a phone number. Phone is the Initiative's primary way of reaching a Member, so
 * it is required — but it is stored unverified in v1 (§5 defers verification, and
 * `phone_number_verified` already exists so it bolts on later without a rebuild).
 */
export type MemberProfile = { name: string; phoneNumber: string | null };

/**
 * Whether a Member has supplied the §5 account data. False for the state a
 * magic-link sign-in leaves them in — an empty name and no phone — which is what
 * routes them to "complete your account" before they can earn Points.
 *
 * Pure so both the data layer's callers and the web layer's gate share one
 * definition of "complete" and cannot disagree about it.
 */
export function isProfileComplete(profile: MemberProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.name.trim() !== "" && profile.phoneNumber !== null && profile.phoneNumber.trim() !== ""
  );
}

/** Read a Member's name and phone — the two fields the completeness gate needs. */
export async function memberProfile(db: Database, userId: string): Promise<MemberProfile | null> {
  const rows = await db
    .select({ name: user.name, phoneNumber: user.phoneNumber })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export type SetMemberProfileResult =
  | { status: "updated" }
  | { status: "no-such-member" }
  /** Another Member already holds this phone (`user_phone_number_unique`). */
  | { status: "phone-taken" };

/**
 * Whether a thrown error is Postgres refusing the phone because another row
 * already has it. Drizzle wraps the driver error, so the cause is unwrapped
 * first; the constraint is matched in the message rather than as a field
 * because PGlite and node-postgres name that field differently.
 */
function isPhoneTaken(err: unknown): boolean {
  const cause = ((err as { cause?: unknown }).cause ?? err) as { code?: string; message?: string };
  return cause.code === "23505" && (cause.message ?? "").includes("user_phone_number_unique");
}

/**
 * Record the §5 account data a Member entered on the "complete your account"
 * step. Values are trimmed — a name that is only spaces would pass a NOT NULL
 * column while failing `isProfileComplete`, leaving the Member in a loop.
 *
 * `phone_number_verified` is deliberately left untouched (false): the number is
 * stored, not verified, per §5. The caller is responsible for having validated
 * that the fields are non-empty; this writes what it is given, trimmed.
 *
 * A phone another Member already registered comes back as `phone-taken` rather
 * than escaping as a 23505: the unique index is the invariant, and this is the
 * seam where its refusal becomes something a form can say in Arabic.
 */
export async function setMemberProfile(
  db: Database,
  userId: string,
  input: { name: string; phoneNumber: string },
  at: Date = new Date(),
): Promise<SetMemberProfileResult> {
  let updated: { id: string }[];
  try {
    updated = await db
      .update(user)
      .set({ name: input.name.trim(), phoneNumber: input.phoneNumber.trim(), updatedAt: at })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
  } catch (err) {
    if (isPhoneTaken(err)) return { status: "phone-taken" };
    throw err;
  }
  if (updated.length === 0) return { status: "no-such-member" };
  return { status: "updated" };
}

/**
 * The display name an erased Member appears under, including on Leaderboards
 * where their Points still count. Arabic, because every string a Member reads is
 * Arabic, and neutral rather than accusatory — the person left, which is their
 * right, and the interface should not editorialise about it.
 */
export const ANONYMISED_NAME = "عضو سابق";

/**
 * Honour a Member's request to be erased without destroying the record that
 * they did the work.
 *
 * Deleting the `user` row is not available to us: `point_award.user_id` is
 * ON DELETE RESTRICT, so the database refuses. That refusal is the design (ADR
 * 0016). A Point is "a record, not a currency" — if closing an account silently
 * removed rows from the ledger, every past Season's Leaderboard would quietly
 * reorder itself, and a Leaderboard that rewrites history is not a record of
 * effort. So identity is scrubbed and the row is kept as an anchor.
 *
 * What survives is deliberately the minimum that keeps foreign keys valid: an
 * id, a placeholder display name, and a non-identifying unique email. What goes
 * is everything that points at a person — real name, email, avatar, phone — plus
 * every credential and live session, so the account cannot be signed back into.
 */
export async function anonymiseMember(
  db: Database,
  userId: string,
  at: Date = new Date(),
): Promise<AnonymiseResult> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: user.id, anonymisedAt: user.anonymisedAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const found = existing[0];
    if (!found) return { status: "no-such-member" };

    /**
     * Idempotent by design. Erasure requests arrive by email, get forwarded and
     * actioned twice; a second run must not overwrite the first date, because
     * that date is the evidence of when the obligation was met.
     */
    if (found.anonymisedAt) {
      return { status: "already-anonymised", at: found.anonymisedAt };
    }

    /**
     * `email` is NOT NULL and unique, so it cannot simply be blanked — two
     * erased members would collide on the empty string. The id is already
     * unique, so deriving the placeholder from it is collision-free by
     * construction, and `.invalid` is reserved by RFC 2606 precisely so that it
     * can never be delivered to, nor mistaken for a real address.
     */
    await tx
      .update(user)
      .set({
        name: ANONYMISED_NAME,
        email: `anonymised+${userId}@faseela.invalid`,
        emailVerified: false,
        image: null,
        phoneNumber: null,
        phoneNumberVerified: false,
        anonymisedAt: at,
        updatedAt: at,
      })
      .where(eq(user.id, userId));

    /**
     * Sessions and credentials are deleted outright rather than scrubbed. Unlike
     * the ledger, nothing references them and they record no effort — they are
     * pure access, and access is exactly what erasure must remove. Their own FKs
     * cascade from `user`, but we are not deleting the user, so this is explicit.
     */
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));

    return { status: "anonymised", at };
  });
}
