import {
  toApiLeaderboardRow,
  toApiSeason,
  type ApiErr,
  type ApiOk,
  type LeaderboardResponse,
} from "@faseela/api-types";
import { currentSeason, seasonLeaderboard } from "@faseela/db";

import { db } from "@/lib/db";

/**
 * `GET /api/v1/leaderboard` — the current Season's ranking.
 *
 * `season: null` with empty rows is a 200, not an error, for the same reason
 * `/lawha` renders an honest "no open season" page: between Seasons there is
 * nothing to rank, and that is a designed state of the product. A client that
 * receives `null` should say so, not retry.
 */
export async function GET() {
  try {
    const season = await currentSeason(db);

    const body = (
      season
        ? {
            data: {
              season: toApiSeason(season),
              rows: (await seasonLeaderboard(db, season.id)).map(toApiLeaderboardRow),
            },
          }
        : { data: { season: null, rows: [] } }
    ) satisfies ApiOk<LeaderboardResponse>;

    /**
     * Thirty seconds, not five minutes: the Leaderboard changes the moment
     * anyone completes a Task. Unlike `/lawha` this response is the same for
     * every caller — it never contains the reader's own row — so a shared CDN
     * cache is safe where the page's was not.
     */
    return Response.json(body, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch {
    const body = {
      error: { code: "internal", message: "Something went wrong." },
    } satisfies ApiErr;
    return Response.json(body, { status: 500 });
  }
}
