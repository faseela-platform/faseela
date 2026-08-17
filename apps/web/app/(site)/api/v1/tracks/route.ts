import {
  toApiTrackSummary,
  type ApiErr,
  type ApiOk,
  type TracksResponse,
} from "@faseela/api-types";
import { publishedTracks } from "@faseela/db";

import { db } from "@/lib/db";

/**
 * `GET /api/v1/tracks` — the published Tracks, for the mobile app.
 *
 * The same query the `/masarat` page runs, serialized through
 * `@faseela/api-types` because phones consume HTTP, never `@faseela/db`. The
 * `satisfies` on the body is the drift protection: the serializer's input types
 * are declared structurally in the api-types package, so this call site is
 * where TypeScript checks that the DB rows still fit them. If a `@faseela/db`
 * shape changes, this file stops typechecking rather than the wire silently
 * changing shape.
 */
export async function GET() {
  try {
    const tracks = await publishedTracks(db);

    const body = {
      data: { tracks: tracks.map(toApiTrackSummary) },
    } satisfies ApiOk<TracksResponse>;

    /**
     * The same freshness budget as the `/masarat` page's `revalidate = 60`,
     * loosened to five minutes: Editor-owned content that changes without a
     * deploy, read far more often than it changes. The long
     * `stale-while-revalidate` lets the CDN keep answering instantly while it
     * refetches — a mobile list view should never wait on Neon.
     */
    return Response.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
    });
  } catch {
    /**
     * The message stays generic on purpose. A caught error here is a database
     * or configuration failure, and its details (connection strings, table
     * names) belong in server logs, not in a public response body.
     */
    const body = {
      error: { code: "internal", message: "Something went wrong." },
    } satisfies ApiErr;
    return Response.json(body, { status: 500 });
  }
}
