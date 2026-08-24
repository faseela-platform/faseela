import { asc, eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { task, track } from "./content";
import { memberTier, pointAward } from "./progress";

/**
 * The permission ladder as behaviour (spec §45–49): read a Member's *standing*
 * from the append-only ledger, never a stored column (ADR 0015 — a cached derived
 * value drifts). The thresholds live in the `member_tier` table (Admin-editable,
 * §46); everything here derives a tier from them and a Points total.
 *
 * Tiers run on **lifetime** Points, deliberately unlike the season-scoped
 * Leaderboard: standing is earned and kept, ranking resets each Season. See the
 * ADR for that reconciliation.
 */

/** One rung of the ladder. */
export type Tier = { key: string; name: string; minPoints: number; position: number };

/**
 * The tier a Points total earns: the highest rung whose `min_points` it meets.
 * Pure, and order-independent (does not assume the ladder is sorted), so the same
 * definition can run on the server or against a hand-built ladder in a test. Null
 * only if the ladder is empty or every rung is above `points` — in practice the
 * seeded floor tier is 0, so a real ladder always returns a tier.
 */
export function tierForPoints(points: number, tiers: Tier[]): Tier | null {
  let best: Tier | null = null;
  for (const t of tiers) {
    if (points >= t.minPoints && (best === null || t.minPoints > best.minPoints)) {
      best = t;
    }
  }
  return best;
}

/** The ladder itself, low rung to high — the Admin-editable thresholds (§46). */
export async function tierThresholds(db: Database): Promise<Tier[]> {
  return db
    .select({
      key: memberTier.key,
      name: memberTier.name,
      minPoints: memberTier.minPoints,
      position: memberTier.position,
    })
    .from(memberTier)
    .orderBy(asc(memberTier.position));
}

/**
 * A Member's **lifetime** Points — summed across every Season, unlike
 * `memberSeasonPoints`. This is the figure the tier keys off: standing accumulates
 * and never resets, even as the Leaderboard turns over each Season.
 */
export async function memberLifetimePoints(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${pointAward.points}), 0)::int` })
    .from(pointAward)
    .where(eq(pointAward.userId, userId));
  return row?.total ?? 0;
}

export type TrackPoints = {
  trackId: string;
  trackSlug: string;
  trackTitle: string;
  points: number;
};

/**
 * A Member's Points broken down by Track — shown on their profile as information
 * (the per-track lens the tier itself does not use, since the tier is global).
 * Highest-earning Track first. Lifetime, matching the tier.
 */
export async function memberTrackPoints(db: Database, userId: string): Promise<TrackPoints[]> {
  const rows = await db
    .select({
      trackId: track.id,
      trackSlug: track.slug,
      trackTitle: track.title,
      points: sql<number>`sum(${pointAward.points})::int`,
    })
    .from(pointAward)
    .innerJoin(task, eq(task.id, pointAward.taskId))
    .innerJoin(track, eq(track.id, task.trackId))
    .where(eq(pointAward.userId, userId))
    .groupBy(track.id, track.slug, track.title)
    .orderBy(sql`sum(${pointAward.points}) desc`);
  return rows.map((r) => ({ ...r, points: Number(r.points) }));
}

export type MemberProgress = {
  tier: Tier;
  points: number;
  nextTier: Tier | null;
  pointsToNext: number | null;
};

/**
 * Where a Member stands on the ladder: their current tier, lifetime Points, the
 * next rung, and how many Points reach it. `nextTier`/`pointsToNext` are null at
 * the top — there is nowhere higher to climb.
 */
export async function memberProgress(db: Database, userId: string): Promise<MemberProgress> {
  const [tiers, points] = await Promise.all([tierThresholds(db), memberLifetimePoints(db, userId)]);

  const tier = tierForPoints(points, tiers);
  if (!tier) throw new Error("No tier ladder is configured");

  /** The lowest rung strictly above the current one, if any. */
  const nextTier =
    tiers
      .filter((t) => t.minPoints > tier.minPoints)
      .sort((a, b) => a.minPoints - b.minPoints)[0] ?? null;

  return {
    tier,
    points,
    nextTier,
    pointsToNext: nextTier ? nextTier.minPoints - points : null,
  };
}
