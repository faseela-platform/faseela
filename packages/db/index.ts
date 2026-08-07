/**
 * The data layer. Deep module: consumers import from `@faseela/db` and never
 * reach into `lib/` — enforced by dependency-cruiser, see packages/README.md.
 *
 * The narrow surface here is deliberate. Callers get the schema, a typed client
 * factory, and the two operations that carry real invariants (awarding Points,
 * reading a Leaderboard). They do not get a general query builder, because the
 * moment award logic can be written at a call site, the idempotency guarantee
 * in `awardPoints` becomes advisory.
 */

export * as schema from "./lib/schema";
export { createClient, type Database } from "./lib/client";
export { awardPoints, type AwardResult } from "./lib/awards";
export { seasonLeaderboard, type LeaderboardRow } from "./lib/leaderboard";
export { currentSeason } from "./lib/seasons";
