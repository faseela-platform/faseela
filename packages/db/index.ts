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
/**
 * The only sanctioned way to read Tracks for the public site. Exported as
 * functions rather than leaving pages to query `schema.track` themselves,
 * because every one of these carries the `state = 'published'` filter — and a
 * page that assembles its own query is one forgotten `where` away from showing
 * an Editor's unfinished draft to the public.
 */
export { publishedTracks, trackBySlug, type TrackSummary, type TrackDetail } from "./lib/tracks";
/**
 * Exported because it is the *only* sanctioned way to remove a Member: the
 * RESTRICT on `point_award.user_id` makes a plain delete raise, and a caller who
 * cannot find this function will reach for raw SQL to get around that. Making it
 * obvious is the cheapest defence of the ledger.
 */
export { anonymiseMember, ANONYMISED_NAME, type AnonymiseResult } from "./lib/members";
