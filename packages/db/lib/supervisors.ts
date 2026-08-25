import { and, asc, eq } from "drizzle-orm";

import type { Database } from "./client";
import { track, trackSupervisor } from "./content";
import { user } from "./identity";
import type { UserRole } from "./members";

/**
 * Track supervision (spec §35): which Editors may manage which Tracks. Assignment
 * is a deliberate admin act (§35: never earned by Points), so these record and read
 * it; the *authority* to call them is enforced by the `/idara` gates (§36).
 */

export type AssignResult =
  | { status: "assigned" }
  | { status: "already-assigned" }
  | { status: "track-not-found" }
  | { status: "user-not-found" };

export async function assignSupervisor(
  db: Database,
  trackId: string,
  userId: string,
): Promise<AssignResult> {
  return db.transaction(async (tx) => {
    const [t] = await tx.select({ id: track.id }).from(track).where(eq(track.id, trackId)).limit(1);
    if (!t) return { status: "track-not-found" };
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
    if (!u) return { status: "user-not-found" };

    const inserted = await tx
      .insert(trackSupervisor)
      .values({ trackId, userId })
      .onConflictDoNothing({ target: [trackSupervisor.trackId, trackSupervisor.userId] })
      .returning({ id: trackSupervisor.id });
    return inserted[0] ? { status: "assigned" } : { status: "already-assigned" };
  });
}

export type RemoveSupervisorResult = { status: "removed" } | { status: "not-assigned" };

export async function removeSupervisor(
  db: Database,
  trackId: string,
  userId: string,
): Promise<RemoveSupervisorResult> {
  const removed = await db
    .delete(trackSupervisor)
    .where(and(eq(trackSupervisor.trackId, trackId), eq(trackSupervisor.userId, userId)))
    .returning({ id: trackSupervisor.id });
  return removed.length > 0 ? { status: "removed" } : { status: "not-assigned" };
}

export type TrackSupervisorRow = { userId: string; name: string };

/** The Editors supervising one Track. */
export async function supervisorsOfTrack(db: Database, trackId: string): Promise<TrackSupervisorRow[]> {
  return db
    .select({ userId: user.id, name: user.name })
    .from(trackSupervisor)
    .innerJoin(user, eq(user.id, trackSupervisor.userId))
    .where(eq(trackSupervisor.trackId, trackId))
    .orderBy(asc(user.name));
}

/** The Track ids one Editor supervises — their scope. */
export async function tracksSupervisedBy(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ trackId: trackSupervisor.trackId })
    .from(trackSupervisor)
    .where(eq(trackSupervisor.userId, userId));
  return rows.map((r) => r.trackId);
}

/**
 * Whether a staff member may manage a given Track: `admin` may manage any; an
 * `editor` only the Tracks they supervise; anyone else, none. Pure, so the web gate
 * and the data layer share one definition (mirrors `isStaffRole`).
 */
export function canManageTrackScope(
  role: UserRole | null,
  supervisedTrackIds: string[],
  trackId: string,
): boolean {
  if (role === "admin") return true;
  if (role === "editor") return supervisedTrackIds.includes(trackId);
  return false;
}
