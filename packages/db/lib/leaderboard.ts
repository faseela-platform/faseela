import { eq, sql } from "drizzle-orm";

import type { Database } from "./client";
import { user } from "./identity";
import { pointAward } from "./progress";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  points: number;
  /** When this Member reached their total — the tie-break, and worth showing. */
  lastAwardedAt: Date;
};

/**
 * The Leaderboard for one Season: Members ranked by Points earned within it.
 *
 * Always Season-scoped. CONTEXT.md: "a lifetime ranking is a different thing and
 * does not exist" — so there is no variant of this function without a Season.
 *
 * Two separate concerns, deliberately not conflated:
 *
 * **Rank** is what a Member is told. It is computed from Points alone, so two
 * Members on the same total share a rank — being told you are 5th when someone
 * else with your exact score is 4th is not something the product can justify.
 *
 * **Order** is which row is printed first, and it breaks the tie on who reached
 * the total earliest. This exists for stability rather than fairness: without a
 * total ordering, Postgres may return tied rows in any order, so a Member could
 * appear to move between two loads of the same page without earning anything.
 *
 * Putting the tie-break inside `RANK`'s window — the obvious implementation —
 * silently makes it a `ROW_NUMBER`, because the ordering becomes unique and no
 * two rows can ever be peers. That is the bug this comment exists to prevent.
 */
export async function seasonLeaderboard(
  db: Database,
  seasonId: string,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const points = sql<number>`sum(${pointAward.points})::int`;
  const lastAwardedAt = sql<Date>`max(${pointAward.awardedAt})`;

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      points,
      lastAwardedAt,
      rank: sql<number>`rank() over (order by sum(${pointAward.points}) desc)::int`,
    })
    .from(pointAward)
    .innerJoin(user, eq(user.id, pointAward.userId))
    .where(eq(pointAward.seasonId, seasonId))
    .groupBy(user.id, user.name, user.image)
    .orderBy(sql`sum(${pointAward.points}) desc, max(${pointAward.awardedAt}) asc`)
    .limit(limit);

  return rows as LeaderboardRow[];
}
