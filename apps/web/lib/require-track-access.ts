import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { canManageTrackScope, roleOfUser, tracksSupervisedBy } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Staff = {
  id: string;
  name: string;
  role: "editor" | "admin";
  /** The Tracks this staffer supervises. Empty for an admin (they manage all). */
  supervisedTrackIds: string[];
};

/**
 * The staff gate for the dashboard (spec §35/§36). Admits `editor` and `admin`;
 * a member gets a 404. Returns the role plus the Tracks the person supervises, so
 * a page can show a supervisor only their own Tracks and an admin everything.
 */
export async function requireStaff(): Promise<Staff> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/dukhul?callbackURL=${encodeURIComponent("/idara")}`);
  }
  const role = await roleOfUser(db, session.user.id);
  if (role !== "editor" && role !== "admin") {
    notFound();
  }
  const supervisedTrackIds = role === "admin" ? [] : await tracksSupervisedBy(db, session.user.id);
  return { id: session.user.id, name: session.user.name, role, supervisedTrackIds };
}

/**
 * The per-Track gate (§35): staff who may manage this specific Track — an admin, or
 * an editor assigned to it. Refuses (404) anyone else, so a supervisor cannot reach
 * another Track's page by editing the URL (§36 — enforced on the server).
 */
export async function requireTrackAccess(trackId: string): Promise<Staff> {
  const staff = await requireStaff();
  if (!canManageTrackScope(staff.role, staff.supervisedTrackIds, trackId)) {
    notFound();
  }
  return staff;
}
