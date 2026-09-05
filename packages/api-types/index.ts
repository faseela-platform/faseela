/**
 * Wire types and serializers for the JSON API (`/api/v1/*`).
 *
 * Reads (tracks, leaderboard, feed) and — since mobile parity (§1) — a small set of
 * authenticated writes (attest, profile) and member reads (me). The mobile app
 * consumes HTTP, never `@faseela/db` — node-postgres cannot run on a phone — so the
 * shapes that cross the wire live here, in a package that depends on nothing. Dates
 * become ISO strings, because JSON has no `Date`.
 *
 * The serializers' input types are declared structurally rather than imported
 * from `@faseela/db`: importing them would drag the database package into every
 * consumer of this one, and zero dependencies is the point. Structural
 * compatibility with the real DB rows is checked where the web app calls these
 * functions — a `satisfies` in each route handler fails the web typecheck the
 * day a DB shape drifts.
 */

/** A track summary as `publishedTracks` returns it — no Dates, but mapped anyway (see below). */
type TrackSummaryLike = {
  slug: string;
  title: string;
  summary: string;
  position: number;
  taskCount: number;
  totalPoints: number;
};

/** A track with its tasks, as `trackBySlug` returns it. */
type TrackDetailLike = {
  slug: string;
  title: string;
  summary: string;
  totalPoints: number;
  tasks: readonly TrackTaskLike[];
};

type TrackTaskLike = {
  id: string;
  title: string;
  instructions: string;
  mode: "attest" | "review";
  points: number;
  position: number;
};

export type ApiTrackSummary = {
  slug: string;
  title: string;
  summary: string;
  position: number;
  taskCount: number;
  totalPoints: number;
};

export type ApiTrackTask = {
  id: string;
  title: string;
  instructions: string;
  mode: "attest" | "review";
  points: number;
  position: number;
};

export type ApiTrackDetail = {
  slug: string;
  title: string;
  summary: string;
  totalPoints: number;
  tasks: ApiTrackTask[];
};

/**
 * Field-by-field even though no Date needs converting. Spreading the input would
 * forward whatever extra columns the DB row grows, silently widening the wire
 * contract; an explicit mapping means a new field reaches phones only when
 * someone decides it should.
 */
export function toApiTrackSummary(track: TrackSummaryLike): ApiTrackSummary {
  return {
    slug: track.slug,
    title: track.title,
    summary: track.summary,
    position: track.position,
    taskCount: track.taskCount,
    totalPoints: track.totalPoints,
  };
}

export function toApiTrackDetail(track: TrackDetailLike): ApiTrackDetail {
  return {
    slug: track.slug,
    title: track.title,
    summary: track.summary,
    totalPoints: track.totalPoints,
    tasks: track.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      mode: task.mode,
      points: task.points,
      position: task.position,
    })),
  };
}

/** A season row as `currentSeason` returns it — before serialization. */
type SeasonLike = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * No `createdAt`. The DB row carries one, but it is bookkeeping about the row
 * itself, not a fact about the Season — the mobile app has nothing to render
 * with it, and a field on the wire is a field that must be supported forever.
 */
export type ApiSeason = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

export function toApiSeason(season: SeasonLike): ApiSeason {
  return {
    id: season.id,
    slug: season.slug,
    title: season.title,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
  };
}

/** A leaderboard row as `seasonLeaderboard` returns it — before serialization. */
type LeaderboardRowLike = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  points: number;
  lastAwardedAt: Date;
};

export type ApiLeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  points: number;
  lastAwardedAt: string;
};

export function toApiLeaderboardRow(row: LeaderboardRowLike): ApiLeaderboardRow {
  return {
    rank: row.rank,
    userId: row.userId,
    name: row.name,
    image: row.image,
    points: row.points,
    lastAwardedAt: row.lastAwardedAt.toISOString(),
  };
}

/**
 * Response bodies, one type per endpoint, so a route handler and a mobile
 * client can both name the whole payload rather than reassembling it from
 * parts.
 */
export type TracksResponse = { tracks: ApiTrackSummary[] };
/** §11: the Track page carries its follower count. Whether THIS reader follows it
 * is derived client-side from `/me`'s `followedTrackIds` — the count is public and
 * cacheable, the reader's own state is not, and mixing them would poison the CDN. */
export type TrackDetailResponse = ApiTrackDetail & { trackId: string; followerCount: number };
/** `season: null` between Seasons — a designed state, not an error. */
export type LeaderboardResponse = { season: ApiSeason | null; rows: ApiLeaderboardRow[] };

/**
 * The envelope. Success wraps the payload in `data`; failure carries a machine
 * `code` and a human `message`. Distinct top-level keys mean a client can
 * discriminate without inspecting status codes.
 */
export type ApiOk<T> = { data: T };
export type ApiErr = {
  error: {
    code:
      | "not_found"
      | "internal"
      /** No valid session/token — the client should sign in. */
      | "unauthenticated"
      /** Signed in, but the §5 account (name + phone) is not complete yet. */
      | "profile-incomplete"
      /** The request body failed validation (missing/blank field). */
      | "validation"
      /** The write conflicts with current state (e.g. Task not attestable). */
      | "conflict"
      /** No open Season to count Points toward — a matter of waiting, not of the Task. */
      | "no-season"
      /** §19/§42: the chosen content is not one this Task offers (or the Task offers none). */
      | "invalid-content"
      /** File uploads are off (R2 unconfigured) — text submission still works. */
      | "uploads-unavailable"
      /** The file's extension is outside the submission allow-list. */
      | "unsupported-type";
    message: string;
  };
};

// ---------------------------------------------------- Writes & member reads (§1)

/**
 * `POST /api/v1/attest` — complete an attest Task. The Member id is derived from
 * the session/token on the server, **never** sent in the body (the same invariant
 * the web Server Action holds).
 */
export type AttestRequest = { taskId: string };
export type AttestResponse = {
  taskId: string;
  status: "completed" | "already-completed";
  points: number;
};

/** `POST /api/v1/profile` — complete the §5 account (name + phone). */
export type ProfileRequest = { name: string; phone: string };
export type ApiMemberProfile = { name: string; phoneNumber: string | null; complete: boolean };
export type ProfileResponse = { profile: ApiMemberProfile };

type MemberProfileLike = { name: string; phoneNumber: string | null };
export function toApiMemberProfile(p: MemberProfileLike, complete: boolean): ApiMemberProfile {
  return { name: p.name, phoneNumber: p.phoneNumber, complete };
}

/** The Member's standing, as `memberProgress` returns it — tiers named, not nested. */
type ProgressLike = {
  tier: { name: string };
  points: number;
  nextTier: { name: string } | null;
  pointsToNext: number | null;
};
export type ApiProgress = {
  tier: string;
  points: number;
  nextTier: string | null;
  pointsToNext: number | null;
};
export function toApiProgress(p: ProgressLike): ApiProgress {
  return {
    tier: p.tier.name,
    points: p.points,
    nextTier: p.nextTier?.name ?? null,
    pointsToNext: p.pointsToNext,
  };
}

/** `GET /api/v1/me` — who the token belongs to, their standing, and their done-state. */
export type MeResponse = {
  user: { id: string; name: string };
  profileComplete: boolean;
  progress: ApiProgress;
  completedTaskIds: string[];
  /** §10 — the Tracks this Member follows, for the app's follow buttons and zones. */
  followedTrackIds: string[];
};

/**
 * A content piece for the mobile Feed (§3). `imageUrl` is a short-lived presigned
 * URL the route mints; the DB row carries only the opaque `mediaKey`, which never
 * crosses the wire.
 */
type ContentItemLike = {
  id: string;
  type: string;
  title: string;
  body: string;
  classification: string | null;
  linkUrl: string | null;
  eventAt: Date | null;
  eventPlace: string | null;
  publishedAt: Date;
  trackSlug: string | null;
  trackTitle: string | null;
};
export type ApiContentItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  classification: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  eventAt: string | null;
  eventPlace: string | null;
  publishedAt: string;
  trackSlug: string | null;
  trackTitle: string | null;
};
export function toApiContentItem(item: ContentItemLike, imageUrl: string | null): ApiContentItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    classification: item.classification,
    imageUrl,
    linkUrl: item.linkUrl,
    eventAt: item.eventAt ? item.eventAt.toISOString() : null,
    eventPlace: item.eventPlace,
    publishedAt: item.publishedAt.toISOString(),
    trackSlug: item.trackSlug,
    trackTitle: item.trackTitle,
  };
}
export type FeedResponse = { items: ApiContentItem[] };

/**
 * A notification in a Member's bell (§38). `seen` is computed per reader against
 * their own watermark, so the same row serialises differently for two people — which
 * is why it is a field on the wire rather than something the client could derive.
 */
type NotificationLike = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  trackSlug: string | null;
  trackTitle: string | null;
  publishedAt: Date;
  seen: boolean;
};
export type ApiNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  trackSlug: string | null;
  trackTitle: string | null;
  publishedAt: string;
  seen: boolean;
};
export function toApiNotification(n: NotificationLike): ApiNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    linkUrl: n.linkUrl,
    trackSlug: n.trackSlug,
    trackTitle: n.trackTitle,
    publishedAt: n.publishedAt.toISOString(),
    seen: n.seen,
  };
}
export type NotificationsResponse = { items: ApiNotification[]; unreadCount: number };

/* ------------------------------------------------------------------ R3 (Slices 12+13) */

/** متابعة المسار (§10): follow/unfollow a Track. The Member comes from the session. */
export type FollowRequest = { trackId: string };
export type FollowResponse = { trackId: string; following: boolean; followers: number };

/** A Track's content piece (§13/§31) — `imageUrl` presigned by the route, like the Feed. */
export type ApiTrackContentItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  classification: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string;
};
export type TrackContentResponse = { items: ApiTrackContentItem[] };

/** A Task as §14 lists it under a content piece — enough to start working. */
export type ApiLinkedTask = {
  id: string;
  title: string;
  instructions: string;
  mode: "attest" | "review";
  points: number;
};
/** §14 صفحة المحتوى: the piece, its Track, and the Tasks linked to it (§15 path 1). */
export type ContentDetailResponse = ApiTrackContentItem & {
  trackSlug: string | null;
  trackTitle: string | null;
  eventAt: string | null;
  eventPlace: string | null;
  linkedTasks: ApiLinkedTask[];
};

/** The home's zones 2 and 5 (§3) for the app. */
export type ApiFollowedTrack = {
  slug: string;
  title: string;
  latest: { title: string; publishedAt: string } | null;
};
export type ApiDiscoverTrack = { slug: string; title: string; summary: string };
export type HomeZonesResponse = { followed: ApiFollowedTrack[]; discover: ApiDiscoverTrack[] };

/** سجل أعمالي (§30 addition): the Member's own completed and open work. */
export type ApiCompletedWork = {
  taskTitle: string;
  trackSlug: string;
  trackTitle: string;
  points: number;
  awardedAt: string;
};
export type ApiOpenWork = {
  taskTitle: string;
  trackSlug: string;
  trackTitle: string;
  state: "draft" | "pending" | "returned" | "rejected" | "cancelled";
  updatedAt: string;
};
export type WorkRecordResponse = { completed: ApiCompletedWork[]; submissions: ApiOpenWork[] };

type TrackContentItemLike = {
  id: string;
  type: string;
  title: string;
  body: string;
  classification: string | null;
  linkUrl: string | null;
  publishedAt: Date;
};
export function toApiTrackContentItem(
  item: TrackContentItemLike,
  imageUrl: string | null,
): ApiTrackContentItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    classification: item.classification,
    imageUrl,
    linkUrl: item.linkUrl,
    publishedAt: item.publishedAt.toISOString(),
  };
}

type WorkRecordLike = {
  completed: {
    taskTitle: string;
    trackSlug: string;
    trackTitle: string;
    points: number;
    awardedAt: Date;
  }[];
  submissions: {
    taskTitle: string;
    trackSlug: string;
    trackTitle: string;
    state: "draft" | "pending" | "returned" | "rejected" | "cancelled";
    updatedAt: Date;
  }[];
};
export function toApiWorkRecord(record: WorkRecordLike): WorkRecordResponse {
  return {
    completed: record.completed.map((c) => ({ ...c, awardedAt: c.awardedAt.toISOString() })),
    submissions: record.submissions.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
  };
}

// ------------------------------------------- Review submission on mobile (§16–§26)

/**
 * The Member's own Submission for one Task — what `GET /api/v1/tasks/:id/submission`
 * returns so the phone can render the same panel the web's review-panel builds from
 * `memberSubmissions`: the working copy (draft/returned are editable), the pending
 * lock, and the reviewer's note when the work came back. The `mediaKey` is the
 * Member's own attached file, returned so a resubmission can carry it forward.
 */
export type ApiMySubmission = {
  taskId: string;
  state: "draft" | "pending" | "accepted" | "rejected" | "returned" | "cancelled";
  body: string | null;
  mediaKey: string | null;
  contentId: string | null;
  reviewNote: string | null;
  updatedAt: string;
};

export function toApiMySubmission(s: {
  taskId: string;
  state: ApiMySubmission["state"];
  body: string | null;
  mediaKey: string | null;
  contentId: string | null;
  reviewNote: string | null;
  updatedAt: Date;
}): ApiMySubmission {
  return {
    taskId: s.taskId,
    state: s.state,
    body: s.body,
    mediaKey: s.mediaKey,
    contentId: s.contentId,
    reviewNote: s.reviewNote,
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** A choice for a content-scoped Task's «المحتوى المختار» picker (§15 path 2 / §19). */
export type ApiContentChoice = { id: string; title: string };

export type TaskSubmissionResponse = {
  submission: ApiMySubmission | null;
  /** Empty when the Task has no content scope — the picker simply doesn't render. */
  choices: ApiContentChoice[];
};

/**
 * `POST /api/v1/tasks/:id/submission` — save a draft (`draft: true`) or submit for
 * review. The Member id comes from the token, never the body (the standing invariant).
 */
export type SubmitSubmissionRequest = {
  body: string;
  mediaKey?: string | null;
  contentId?: string | null;
  draft?: boolean;
};
export type SubmitSubmissionResponse = { state: "submitted" | "draft-saved" };

/** `POST /api/v1/uploads` — mint a presigned PUT so the phone uploads straight to R2. */
export type UploadRequest = { taskId: string; filename: string };
export type UploadTicketResponse = { url: string; key: string };
