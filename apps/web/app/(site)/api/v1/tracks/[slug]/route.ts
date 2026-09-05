import {
  toApiTrackDetail,
  type ApiErr,
  type ApiOk,
  type TrackDetailResponse,
} from "@faseela/api-types";
import { trackBySlug, trackFollowerCounts } from "@faseela/db";

import { db } from "@/lib/db";

/**
 * `GET /api/v1/tracks/:slug` — one Track with its Tasks.
 *
 * A missing slug is a 404 in the same JSON envelope as every other `/api/v1`
 * error, so a mobile client discriminates on `error.code` and never needs to
 * parse a Next.js HTML not-found page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const track = await trackBySlug(db, slug);

    if (!track) {
      const body = {
        error: { code: "not_found", message: "No such track." },
      } satisfies ApiErr;
      /**
       * No cache header on the 404, deliberately. A slug that is missing today
       * may be published this afternoon, and a CDN-cached miss would keep
       * serving "not found" for a Track that now exists.
       */
      return Response.json(body, { status: 404 });
    }

    /** §11: the count is public and rides the same brief cache; the reader's own
     * follow state comes from `/me`, so this response stays shareable. */
    const counts = await trackFollowerCounts(db, [track.id]);
    const body = {
      data: {
        ...toApiTrackDetail(track),
        trackId: track.id,
        followerCount: counts.get(track.id) ?? 0,
      },
    } satisfies ApiOk<TrackDetailResponse>;

    return Response.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
    });
  } catch {
    const body = {
      error: { code: "internal", message: "Something went wrong." },
    } satisfies ApiErr;
    return Response.json(body, { status: 500 });
  }
}
