/**
 * Wire types and serializers for the read-only JSON API (`/api/v1/*`).
 *
 * The mobile app consumes HTTP, never `@faseela/db` — node-postgres cannot run
 * on a phone — so the shapes that cross the wire live here, in a package that
 * depends on nothing. Dates become ISO strings, because JSON has no `Date`.
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
export type ApiErr = { error: { code: "not_found" | "internal"; message: string } };
