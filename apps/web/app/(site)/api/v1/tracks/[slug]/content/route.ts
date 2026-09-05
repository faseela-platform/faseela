import {
  toApiTrackContentItem,
  type ApiErr,
  type ApiOk,
  type TrackContentResponse,
} from "@faseela/api-types";
import { trackBySlug, trackContentItems } from "@faseela/db";

import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";

/**
 * `GET /api/v1/tracks/:slug/content` — the Track's published content (§13's
 * content tab; §31's per-Track materials). Public and briefly cacheable, like the
 * Track detail itself; images become short-lived presigned URLs, like the Feed.
 * `?classification=` narrows to one kind («كتاب», «مقال», …).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const track = await trackBySlug(db, slug);
    if (!track) {
      const body = { error: { code: "not_found", message: "No such track." } } satisfies ApiErr;
      return Response.json(body, { status: 404 });
    }

    const classification =
      new URL(request.url).searchParams.get("classification")?.trim() || undefined;
    const items = await trackContentItems(
      db,
      track.id,
      classification ? { classification } : undefined,
    );
    const withUrls = await Promise.all(
      items.map(async (item) => {
        const imageUrl =
          item.mediaKey && r2IsConfigured ? await presignGetUrl(item.mediaKey, 3600) : null;
        return toApiTrackContentItem(item, imageUrl);
      }),
    );

    const body = { data: { items: withUrls } } satisfies ApiOk<TrackContentResponse>;
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
