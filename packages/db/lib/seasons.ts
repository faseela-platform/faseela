import { and, gt, lte, desc } from "drizzle-orm";

import type { Queryable } from "./client";
import { season } from "./progress";

/**
 * The Season containing `at`, or null if none does.
 *
 * Null is a real state, not an edge case: between Seasons the Initiative has no
 * competition running, and CONTEXT.md is explicit that Points belong to exactly
 * one Season. Callers must decide what to do rather than being handed a
 * fabricated Season — `awardPoints` refuses to mint, which is the honest
 * behaviour: effort outside a Season cannot be ranked.
 *
 * `endsAt` is exclusive so two adjacent Seasons sharing a boundary instant
 * cannot both match.
 */
export async function currentSeason(db: Queryable, at: Date = new Date()) {
  const rows = await db
    .select()
    .from(season)
    .where(and(lte(season.startsAt, at), gt(season.endsAt, at)))
    .orderBy(desc(season.startsAt))
    .limit(1);

  return rows[0] ?? null;
}
