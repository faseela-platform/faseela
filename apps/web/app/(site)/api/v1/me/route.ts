import { toApiProgress, type MeResponse } from "@faseela/api-types";
import {
  followedTrackIds,
  isProfileComplete,
  memberCompletedTaskIds,
  memberProfile,
  memberProgress,
} from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/me` — who the token belongs to, plus their standing and done-state.
 *
 * One authed read the app renders "me" from: name, whether the §5 account is
 * complete (so it can route to the completion screen when needed), tier/points/
 * progress, and every Task the Member has completed (to mark done-state on the
 * Track screens). Private per Member — never cached.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  const [profile, progress, completedTaskIds, followed] = await Promise.all([
    memberProfile(db, user.id),
    memberProgress(db, user.id),
    memberCompletedTaskIds(db, user.id),
    followedTrackIds(db, user.id),
  ]);

  return ok<MeResponse>({
    user: { id: user.id, name: user.name },
    profileComplete: isProfileComplete(profile),
    progress: toApiProgress(progress),
    completedTaskIds,
    followedTrackIds: [...followed],
  });
}
