import { markNotificationsSeen } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `POST /api/v1/notifications/seen` — the Member opened their bell, so everything
 * published up to now is read (§3: «حتى لا يكرر عرضه»).
 *
 * A POST, not a side effect of the GET above: reading a list should not change it, and
 * a client that merely prefetches must not silently clear someone's badge.
 */
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  await markNotificationsSeen(db, user.id);
  return ok<{ unreadCount: number }>({ unreadCount: 0 });
}
