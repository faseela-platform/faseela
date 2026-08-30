"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { setMemberProfile } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeInternalPath } from "@/lib/safe-path";

/**
 * The result the form renders. A validation error is returned so the Member can
 * fix it in place — `field` says which input to mark invalid, so the other one
 * is not flagged for a mistake it did not make; on success the action redirects
 * and never returns.
 */
export type CompleteAccountState = { error: string; field: "name" | "phone" } | null;

/**
 * Record the §5 account data — full name and phone (the primary contact) — that
 * magic-link sign-in did not collect, then send the Member on to whatever they
 * were trying to do.
 *
 * The Member id is read from the session, never the form: the same reason the
 * attest action does it, since a supplied id would let one Member overwrite
 * another's profile. Phone is stored unverified (§5 defers verification).
 */
export async function completeAccount(input: {
  name: string;
  phone: string;
  next?: string;
}): Promise<CompleteAccountState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/dukhul");

  const name = input.name.trim();
  const phone = input.phone.trim();

  if (name === "") {
    return { error: "أدخل اسمك الكامل.", field: "name" };
  }
  /**
   * A light check, not verification. §5 defers verifying the number; this only
   * rejects an obviously-empty or non-numeric entry so the stored value is
   * plausibly a phone. Digits are counted rather than a format matched, because
   * Lebanese numbers are written many ways (+961, 03…, spaces, dashes) and a
   * strict pattern would reject valid input.
   */
  const digitCount = (phone.match(/\d/g) ?? []).length;
  if (digitCount < 6) {
    return { error: "أدخل رقم هاتف صحيح.", field: "phone" };
  }

  const result = await setMemberProfile(db, session.user.id, { name, phoneNumber: phone });
  /**
   * The phone is unique per Member (`user_phone_number_unique`). The data layer
   * turns that refusal into a result rather than a thrown 23505, and here it
   * becomes an inline sentence on the phone field — never a 500 page for typing
   * a number a family member already registered.
   */
  if (result.status === "phone-taken") {
    return { error: "هذا الرقم مسجّل لحساب آخر.", field: "phone" };
  }
  // The session named a user the table no longer has: there is no account to complete.
  if (result.status === "no-such-member") redirect("/dukhul");

  /**
   * The Leaderboard shows the Member's name, so it must be re-rendered now that
   * a previously-nameless row has one.
   */
  revalidatePath("/lawha");

  redirect(safeInternalPath(input.next));
}
