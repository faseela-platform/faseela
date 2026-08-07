import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { account, session, user } from "./identity";

export type AnonymiseResult =
  | { status: "anonymised"; at: Date }
  | { status: "already-anonymised"; at: Date }
  | { status: "no-such-member" };

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
