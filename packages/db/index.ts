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
export {
  attestTask,
  completedTaskIds,
  memberCompletedTaskIds,
  memberSeasonPoints,
  type AttestResult,
} from "./lib/attest";
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
  submissionTrackId,
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
  updateTier,
  type Tier,
  type TierUpdate,
  type TrackPoints,
  type MemberProgress,
  type TierEditResult,
} from "./lib/tiers";
/**
 * Track supervision (§35) — which Editors manage which Tracks; the scope layered on
 * the staff `role`. `canManageTrackScope` is the pure predicate the web gates share.
 */
export {
  assignSupervisor,
  removeSupervisor,
  supervisorsOfTrack,
  tracksSupervisedBy,
  canManageTrackScope,
  type AssignResult,
  type RemoveSupervisorResult,
  type TrackSupervisorRow,
} from "./lib/supervisors";
/**
 * The only sanctioned way to read Tracks for the public site. Exported as
 * functions rather than leaving pages to query `schema.track` themselves,
 * because every one of these carries the `state = 'published'` filter — and a
 * page that assembles its own query is one forgotten `where` away from showing
 * an Editor's unfinished draft to the public.
 */
export { publishedTracks, trackBySlug, type TrackSummary, type TrackDetail } from "./lib/tracks";
/**
 * The admin authoring surface (spec §34/§35) — the Track/Task writes that retire
 * `scripts/seed.mjs`. Authority is enforced by the `/idara` route gates; these are
 * the mechanism. Admin reads (`adminTracks`/`adminTrack`) see drafts, unlike the
 * public `published`-only reads above.
 */
export {
  createTrack,
  updateTrack,
  publishTrack,
  archiveTrack,
  unpublishTrack,
  createTask,
  updateTask,
  publishTask,
  archiveTask,
  unpublishTask,
  deleteTask,
  taskTrackId,
  adminTracks,
  adminTrack,
  createContentItem,
  updateContentItem,
  publishContentItem,
  archiveContentItem,
  unpublishContentItem,
  deleteContentItem,
  contentTrackId,
  adminContentItems,
  adminContentItem,
  type CreateTrackResult,
  type UpdateTrackResult,
  type CreateTaskResult,
  type UpdateTaskResult,
  type DeleteTaskResult,
  type AdminTrackRow,
  type AdminTaskRow,
  type AdminTrackDetail,
  type ContentType,
  type ContentInput,
  type CreateContentResult,
  type UpdateContentResult,
  type AdminContentRow,
} from "./lib/content-admin";
/**
 * The public Feed read (§3) and the home's task zone (§3.1). Reads only — content is
 * authored through `content-admin`; here it is rendered.
 */
export { feedItems, type FeedItem } from "./lib/feed";
export { memberHomeTasks, type MemberHomeTask } from "./lib/home";
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
  setUserRole,
  adminMemberList,
  type MemberProfile,
  type SetMemberProfileResult,
  type UserRole,
  type SetUserRoleResult,
  type AdminMember,
} from "./lib/members";
/**
 * Contacting Faseela (§37). `createServiceRequest` is the app's only unauthenticated
 * write, and carries its own guards (field caps, a per-origin rate limit) so every
 * caller inherits them; the admin reads are gated one layer up, in `/idara`.
 */
export {
  createServiceRequest,
  adminServiceRequests,
  updateServiceRequestStatus,
  SERVICE_REQUEST_MAX,
  type ServiceRequestInput,
  type ServiceRequestType,
  type ServiceRequestStatus,
  type CreateServiceRequestResult,
  type AdminServiceRequest,
  type UpdateServiceRequestStatusResult,
} from "./lib/service-requests";
