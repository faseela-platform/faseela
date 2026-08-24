/**
 * The data layer. Deep module: consumers import from `@faseela/db` and never
 * reach into `lib/` — enforced by dependency-cruiser, see packages/README.md.
 *
 * The narrow surface here is deliberate. Callers get the schema, a typed client
 * factory, and the operations that carry real invariants (minting Points, moving
 * a Submission through review, reading a Leaderboard). They do not get a general
 * query builder, because the moment mint logic can be written at a call site, the
 * idempotency and freezing guarantees become advisory.
 */

export * as schema from "./lib/schema";
export { createClient, type Database } from "./lib/client";
/**
 * The `attest` completion path — Points minted on the Member's own declaration.
 * Exported next to the `review` path below because the two are the only ways
 * Points come into existence, and seeing them together is what stops a third
 * being written at a call site.
 */
export { attestTask, completedTaskIds, memberSeasonPoints, type AttestResult } from "./lib/attest";
/**
 * The `review` completion path (spec §16–§26): a Member submits, an Editor decides,
 * and acceptance mints graded Points. `acceptSubmission` is the review-mode mint,
 * the counterpart to `attestTask`.
 */
export {
  saveDraft,
  submitWork,
  cancelDraft,
  acceptSubmission,
  returnSubmission,
  rejectSubmission,
  reviewQueue,
  submissionForReview,
  memberSubmissions,
  type SubmissionInput,
  type SaveDraftResult,
  type SubmitResult,
  type CancelDraftResult,
  type AcceptResult,
  type ReturnResult,
  type RejectResult,
  type ReviewQueueItem,
  type SubmissionDetail,
  type ReviewAttempt,
  type MemberSubmission,
} from "./lib/review";
export { seasonLeaderboard, type LeaderboardRow } from "./lib/leaderboard";
export { currentSeason } from "./lib/seasons";
/**
 * The permission ladder (spec §45–49). Tiers are derived on read from **lifetime**
 * Points against the Admin-editable thresholds in `member_tier` — standing that
 * accumulates, distinct from the season-scoped Leaderboard (ranking). See ADR.
 */
export {
  tierForPoints,
  tierThresholds,
  memberLifetimePoints,
  memberTrackPoints,
  memberProgress,
  type Tier,
  type TrackPoints,
  type MemberProgress,
} from "./lib/tiers";
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
/**
 * Member identity (spec §5). `setMemberProfile` records the name + phone a
 * Member supplies on the "complete your account" step; `memberProfile` +
 * `isProfileComplete` are how the web layer decides whether to route them there.
 */
export {
  setMemberProfile,
  memberProfile,
  isProfileComplete,
  roleOfUser,
  isStaffRole,
  type MemberProfile,
  type SetMemberProfileResult,
  type UserRole,
} from "./lib/members";
