"use server";

import { revalidatePath } from "next/cache";

import {
  archiveNotification,
  createNotification,
  deleteNotification,
  publishNotification,
  unpublishNotification,
  updateNotification,
  type BroadcastType,
} from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Composing and sending the initiative's broadcasts (§38's «قابلة للإدارة من لوحة
 * التحكم»). Admin-only: a notification reaches every Member at once and cannot be
 * unsent, so this is central administration (§34), not a Track supervisor's scope.
 */
export type NotifyState = { status: "ok" | "error"; message: string; id?: string };

function revalidate(id?: string) {
  revalidatePath("/idara/ishaarat");
  if (id) revalidatePath(`/idara/ishaarat/${id}`);
  /** A published broadcast lands in every Member's bell. */
  revalidatePath("/ishaarat");
}

export async function createNotificationAction(input: {
  type: BroadcastType;
  title: string;
  body: string;
}): Promise<NotifyState> {
  const admin = await requireAdmin();
  const r = await createNotification(db, { ...input, createdBy: admin.id });
  if (r.status === "invalid") return { status: "error", message: "العنوان والنص مطلوبان." };
  revalidate(r.id);
  return { status: "ok", message: "حُفظ الإشعار كمسودة.", id: r.id };
}

export async function updateNotificationAction(
  id: string,
  input: { type?: BroadcastType; title?: string; body?: string },
): Promise<NotifyState> {
  await requireAdmin();
  const r = await updateNotification(db, id, input);
  if (r.status === "invalid") return { status: "error", message: "العنوان والنص مطلوبان." };
  if (r.status === "not-found") return { status: "error", message: "الإشعار غير موجود." };
  revalidate(id);
  return { status: "ok", message: "حُفظ الإشعار." };
}

export async function publishNotificationAction(id: string): Promise<NotifyState> {
  await requireAdmin();
  const r = await publishNotification(db, id);
  if (r.status === "not-found") return { status: "error", message: "الإشعار غير موجود." };
  revalidate(id);
  return { status: "ok", message: "أُرسل الإشعار إلى الأعضاء." };
}

export async function unpublishNotificationAction(id: string): Promise<NotifyState> {
  await requireAdmin();
  const r = await unpublishNotification(db, id);
  if (r.status === "not-found") return { status: "error", message: "الإشعار غير موجود." };
  revalidate(id);
  return { status: "ok", message: "سُحب الإشعار وأُعيد مسودة." };
}

export async function archiveNotificationAction(id: string): Promise<NotifyState> {
  await requireAdmin();
  const r = await archiveNotification(db, id);
  if (r.status === "not-found") return { status: "error", message: "الإشعار غير موجود." };
  revalidate(id);
  return { status: "ok", message: "أُرشف الإشعار." };
}

export async function deleteNotificationAction(id: string): Promise<NotifyState> {
  await requireAdmin();
  const r = await deleteNotification(db, id);
  if (r.status === "not-found") return { status: "error", message: "الإشعار غير موجود." };
  revalidate();
  return { status: "ok", message: "حُذف الإشعار." };
}
