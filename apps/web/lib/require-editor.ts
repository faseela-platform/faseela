import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { isStaffRole, roleOfUser } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Editor = { id: string; name: string };

/**
 * The gate on the review area. Every `/muraja3a` page and every review Server
 * Action calls this first — the authority to accept work and mint Points is not a
 * matter of a hidden URL.
 *
 * Two refusals, deliberately different:
 *
 * - **Not signed in** → redirect to sign-in, returning here afterwards. A visitor
 *   who simply is not logged in should be helped to, not stonewalled.
 * - **Signed in but not staff** → `notFound()`, a 404. A 403 would confirm the
 *   review area exists at this path; a 404 is indistinguishable from a route that
 *   was never built, so a curious Member learns nothing.
 *
 * The role is read from the database (`roleOfUser`), not taken from a session
 * claim, so revoking someone's staff status takes effect on their next request
 * rather than their next sign-in. This replaces Payload's admin auth entirely
 * (ADR 0023): an Editor is one of our own users with a staff `role`.
 */
export async function requireEditor(): Promise<Editor> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/dukhul?callbackURL=${encodeURIComponent("/muraja3a")}`);
  }

  const role = await roleOfUser(db, session.user.id);
  if (!isStaffRole(role)) {
    notFound();
  }

  return { id: session.user.id, name: session.user.name };
}
