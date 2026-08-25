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
export type TrackDetailResponse = ApiTrackDetail;
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
      | "conflict";
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
