import { toApiNotification, type NotificationsResponse } from "@faseela/api-types";
import { notificationsFor, unreadNotificationCount } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/notifications` — the Member's bell (§38), for the mobile app.
 *
 * Private per reader: `seen` is computed against *this* Member's watermark, and the
 * list is what is addressed to them plus what was addressed to everyone. Never cached
 * for that reason.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);

  const [items, unreadCount] = await Promise.all([
    notificationsFor(db, user.id),
    unreadNotificationCount(db, user.id),
  ]);

  return ok<NotificationsResponse>({ items: items.map(toApiNotification), unreadCount });
}
