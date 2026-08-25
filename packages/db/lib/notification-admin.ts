import { desc, eq } from "drizzle-orm";

import type { Database } from "./client";
import { notification } from "./notification";

/**
 * Authoring the broadcast half of §38 — «الإشعارات يجب أن تكون قابلة للإدارة من لوحة
 * التحكم». An app update or an important announcement, written by an admin and sent
 * to every Member.
 *
 * Same shape as the Track/Task/content writes: the `published_at` biconditional is
 * honoured on every state change, and results are unions rather than throws. The
 * draft step is not ceremony here — a notification cannot be recalled once it has
 * been read, so being able to write one and publish it deliberately is the point.
 *
 * Per-member event notifications do not come through here at all; they are raised by
 * the transactions that cause them (`notification-emit.ts`).
 */

/**
 * What an admin may send to *everyone*. Deliberately excludes `track_update`: a Track's
 * news belongs to the people following that Track (§38's «لمسار يتابعه المستخدم»), and
 * it is raised by publishing content onto the Track, not composed here. Offering it as
 * a broadcast would mail one Track's update to every Member — the flood «لا يجب تحويل
 * كل تحديث صغير إلى إشعار» exists to prevent.
 */
export type BroadcastType = "app_update" | "announcement";

export type NotificationInput = {
  type: BroadcastType;
  title: string;
  body: string;
  trackId?: string | null;
  linkUrl?: string | null;
};

export type CreateNotificationResult =
  | { status: "created"; id: string }
  | { status: "invalid" };

export async function createNotification(
  db: Database,
  input: NotificationInput & { createdBy: string },
  at: Date = new Date(),
): Promise<CreateNotificationResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title === "" || body === "") return { status: "invalid" };

  const [inserted] = await db
    .insert(notification)
    .values({
      type: input.type,
      /** Null recipient: this is for everyone. */
      userId: null,
      title,
      body,
      trackId: input.trackId ?? null,
      linkUrl: input.linkUrl ?? null,
      state: "draft",
      createdBy: input.createdBy,
      createdAt: at,
      updatedAt: at,
    })
    .returning({ id: notification.id });
  if (!inserted) throw new Error("notification insert returned no row");
  return { status: "created", id: inserted.id };
}

export type UpdateNotificationResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "invalid" };

export async function updateNotification(
  db: Database,
  id: string,
  input: Partial<NotificationInput>,
  at: Date = new Date(),
): Promise<UpdateNotificationResult> {
  if (input.title !== undefined && input.title.trim() === "") return { status: "invalid" };
  if (input.body !== undefined && input.body.trim() === "") return { status: "invalid" };

  const updated = await db
    .update(notification)
    .set({
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.trackId !== undefined ? { trackId: input.trackId } : {}),
      ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
      updatedAt: at,
    })
    .where(eq(notification.id, id))
    .returning({ id: notification.id });
  return updated.length > 0 ? { status: "updated" } : { status: "not-found" };
}

/**
 * Move a notification between states, keeping the `published_at` invariant: publishing
 * stamps the date (or keeps the one it had, so re-publishing does not rewrite when it
 * was sent), archiving and unpublishing clear it — which also takes it back out of
 * everyone's bell, since the member read is `published`-only.
 */
async function setNotificationState(
  db: Database,
  id: string,
  state: "published" | "archived" | "draft",
  at: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ publishedAt: notification.publishedAt })
      .from(notification)
      .where(eq(notification.id, id))
      .limit(1);
    if (!row) return false;
    const publishedAt = state === "published" ? (row.publishedAt ?? at) : null;
    await tx
      .update(notification)
      .set({ state, publishedAt, updatedAt: at })
      .where(eq(notification.id, id));
    return true;
  });
}

export async function publishNotification(db: Database, id: string, at: Date = new Date()) {
  return (await setNotificationState(db, id, "published", at))
    ? ({ status: "published" } as const)
    : ({ status: "not-found" } as const);
}
export async function archiveNotification(db: Database, id: string, at: Date = new Date()) {
  return (await setNotificationState(db, id, "archived", at))
    ? ({ status: "archived" } as const)
    : ({ status: "not-found" } as const);
}
export async function unpublishNotification(db: Database, id: string, at: Date = new Date()) {
  return (await setNotificationState(db, id, "draft", at))
    ? ({ status: "unpublished" } as const)
    : ({ status: "not-found" } as const);
}

export async function deleteNotification(
  db: Database,
  id: string,
): Promise<{ status: "deleted" } | { status: "not-found" }> {
  const deleted = await db
    .delete(notification)
    .where(eq(notification.id, id))
    .returning({ id: notification.id });
  return deleted.length > 0 ? { status: "deleted" } : { status: "not-found" };
}

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  state: "draft" | "published" | "archived";
  userId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
};

/**
 * Every notification, whatever its state, newest first — the authoring list. Includes
 * the per-member events as well as broadcasts, because «قابلة للإدارة من لوحة التحكم»
 * means the team can see what the platform has been sending, not only what they wrote.
 */
export async function adminNotifications(
  db: Database,
  opts?: { limit?: number },
): Promise<AdminNotification[]> {
  return db
    .select({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      state: notification.state,
      userId: notification.userId,
      publishedAt: notification.publishedAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .orderBy(desc(notification.createdAt))
    .limit(opts?.limit ?? 100);
}
