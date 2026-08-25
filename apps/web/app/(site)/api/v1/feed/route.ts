import { toApiContentItem, type FeedResponse } from "@faseela/api-types";
import { feedItems } from "@faseela/db";

import { ok } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";

/**
 * `GET /api/v1/feed` — the content stream (§3) for the mobile home. Public, like the
 * web `/mustajaddat` visitor view: published content, newest first, one merged list.
 *
 * Each item's image is a short-lived presigned GET URL minted here (one hour, so a
 * viewing session holds) — the private `mediaKey` never crosses the wire.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const items = await feedItems(db, { limit: 40 });

  const apiItems = await Promise.all(
    items.map(async (item) => {
      const imageUrl = item.mediaKey && r2IsConfigured ? await presignGetUrl(item.mediaKey, 3600) : null;
      return toApiContentItem(item, imageUrl);
    }),
  );

  return ok<FeedResponse>(
    { items: apiItems },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
