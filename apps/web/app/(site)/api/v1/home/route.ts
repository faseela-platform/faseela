import type { HomeZonesResponse } from "@faseela/api-types";
import { discoveryTracks, followedTracksWithLatest } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/home` — the home's zones 2 and 5 (§3) for the app: the Member's
 * followed Tracks with each one's latest word, and the published Tracks they do
 * not follow yet («اكتشف»). Personal by definition — never cached.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  const [followed, discover] = await Promise.all([
    followedTracksWithLatest(db, user.id),
    discoveryTracks(db, user.id),
  ]);

  return ok<HomeZonesResponse>({
    followed: followed.map((f) => ({
      slug: f.slug,
      title: f.title,
      latest: f.latest
        ? { title: f.latest.title, publishedAt: f.latest.publishedAt.toISOString() }
        : null,
    })),
    discover: discover.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })),
  });
}
