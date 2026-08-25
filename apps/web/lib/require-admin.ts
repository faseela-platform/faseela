import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { roleOfUser } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Admin = { id: string; name: string };

/**
 * The central-admin gate (spec §34/§36). Global authority — roles, tiers,
 * supervisor assignment, creating Tracks — is admin-only. Same shape as
 * `requireEditor`: not signed in → sign-in; signed in but not `admin` → 404, so an
 * editor probing `/idara/aada` learns nothing. Role is read from the DB every
 * request, so revoking admin takes effect at once.
 */
export async function requireAdmin(): Promise<Admin> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/dukhul?callbackURL=${encodeURIComponent("/idara")}`);
  }
  const role = await roleOfUser(db, session.user.id);
  if (role !== "admin") {
    notFound();
  }
  return { id: session.user.id, name: session.user.name };
}
