import type { FollowRequest, FollowResponse } from "@faseela/api-types";
import { followTrack, trackFollowerCounts, unfollowTrack } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * متابعة المسار (§10): `POST /api/v1/follow` follows, `DELETE` unfollows. The
 * Member comes from the session/token, never the body; the Track id arrives in
 * the body for both verbs (a DELETE with a body is legal and keeps the two
 * mirrored). Both are idempotent — the db functions state the no-op rather than
 * erroring, and the response always carries the resulting state and the fresh
 * follower count so the button can settle without a second request.
 */
export const dynamic = "force-dynamic";

async function readTrackId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as FollowRequest;
    return body?.trackId && typeof body.trackId === "string" ? body.trackId : null;
  } catch {
    return null;
  }
}

async function respond(trackId: string, following: boolean): Promise<Response> {
  const counts = await trackFollowerCounts(db, [trackId]);
  return ok<FollowResponse>({ trackId, following, followers: counts.get(trackId) ?? 0 });
}

export async function POST(req: Request): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً لمتابعة المسار.", 401);
  const trackId = await readTrackId(req);
  if (!trackId) return err("validation", "معرّف المسار مطلوب.", 400);

  const result = await followTrack(db, user.id, trackId);
  if (result.status === "not-found") return err("not_found", "لا يوجد هذا المسار.", 404);
  return respond(trackId, true);
}

export async function DELETE(req: Request): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);
  const trackId = await readTrackId(req);
  if (!trackId) return err("validation", "معرّف المسار مطلوب.", 400);

  await unfollowTrack(db, user.id, trackId);
  return respond(trackId, false);
}
