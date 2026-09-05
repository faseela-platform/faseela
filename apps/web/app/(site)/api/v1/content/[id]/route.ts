import {
  toApiTrackContentItem,
  type ApiErr,
  type ApiOk,
  type ContentDetailResponse,
} from "@faseela/api-types";
import { contentItemById } from "@faseela/db";

import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";

/**
 * `GET /api/v1/content/:id` — §14's content page: the piece, its Track, and the
 * Tasks linked to it (§15 path 1). Public; a draft id 404s exactly like an unknown
 * one (the db read guarantees it), so unpublished work cannot be probed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await contentItemById(db, id);
    if (!item) {
      const body = { error: { code: "not_found", message: "No such content." } } satisfies ApiErr;
      return Response.json(body, { status: 404 });
    }

    const imageUrl =
      item.mediaKey && r2IsConfigured ? await presignGetUrl(item.mediaKey, 3600) : null;
    const body = {
      data: {
        ...toApiTrackContentItem(item, imageUrl),
        trackSlug: item.trackSlug,
        trackTitle: item.trackTitle,
        eventAt: item.eventAt ? item.eventAt.toISOString() : null,
        eventPlace: item.eventPlace,
        linkedTasks: item.linkedTasks,
      },
    } satisfies ApiOk<ContentDetailResponse>;
    return Response.json(body, {
      headers: {
        /** The window (300+3000s) must end BEFORE the 3600s image presign does, or the CDN serves cards whose images already died (code-review 2026-09-05). */
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3000",
      },
    });
  } catch {
    const body = { error: { code: "internal", message: "Something went wrong." } } satisfies ApiErr;
    return Response.json(body, { status: 500 });
  }
}
