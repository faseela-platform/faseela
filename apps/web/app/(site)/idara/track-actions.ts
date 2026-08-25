"use server";

import { revalidatePath } from "next/cache";

import {
  archiveTask,
  archiveTrack,
  createTask,
  createTrack,
  deleteTask,
  publishTask,
  publishTrack,
  taskTrackId,
  unpublishTrack,
  updateTask,
  updateTrack,
} from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { requireTrackAccess } from "@/lib/require-track-access";

/**
 * Track/Task authoring, as Server Actions (spec §34/§35). Each re-checks authority
 * on the server before touching `@faseela/db` — creating a Track is admin-only;
 * editing a Track or its Tasks needs access to *that* Track. A Task action reads
 * the Task's real Track id from the DB (`taskTrackId`) and gates on that, so a
 * supervisor cannot reach another Track's Task by id. Rules live in `@faseela/db`;
 * this authenticates, translates to Arabic, and revalidates.
 */
export type ActionState = { status: "ok" | "error"; message: string };

function revalidate(trackId?: string) {
  revalidatePath("/idara/masarat");
  if (trackId) revalidatePath(`/idara/masarat/${trackId}`);
  /** /masarat is ISR (revalidate 60) so a publish must invalidate it to show now;
   * /masarat/[slug] is force-dynamic and re-reads on its own. */
  revalidatePath("/masarat");
}

// -------------------------------------------------------------- Track

export async function createTrackAction(input: {
  slug: string;
  title: string;
  summary: string;
}): Promise<ActionState> {
  await requireAdmin();
  const r = await createTrack(db, input);
  switch (r.status) {
    case "created":
      revalidate();
      return { status: "ok", message: "أُنشئ المسار كمسودة." };
    case "invalid-slug":
      return { status: "error", message: "المُعرّف بأحرف لاتينية وأرقام وشرطات فقط." };
    case "slug-taken":
      return { status: "error", message: "هذا المُعرّف مستخدم لمسار آخر." };
  }
}

export async function updateTrackAction(
  trackId: string,
  input: { title?: string; summary?: string; slug?: string; position?: number },
): Promise<ActionState> {
  await requireTrackAccess(trackId);
  const r = await updateTrack(db, trackId, input);
  switch (r.status) {
    case "updated":
      revalidate(trackId);
      return { status: "ok", message: "حُفظ المسار." };
    case "not-found":
      return { status: "error", message: "المسار غير موجود." };
    case "invalid-slug":
      return { status: "error", message: "المُعرّف بأحرف لاتينية وأرقام وشرطات فقط." };
    case "slug-taken":
      return { status: "error", message: "هذا المُعرّف مستخدم لمسار آخر." };
  }
}

const TRACK_MISSING = { status: "error", message: "المسار غير موجود." } as const;

export async function publishTrackAction(trackId: string): Promise<ActionState> {
  await requireTrackAccess(trackId);
  const r = await publishTrack(db, trackId);
  if (r.status === "not-found") return TRACK_MISSING;
  revalidate(trackId);
  return { status: "ok", message: "نُشر المسار." };
}

export async function unpublishTrackAction(trackId: string): Promise<ActionState> {
  await requireTrackAccess(trackId);
  const r = await unpublishTrack(db, trackId);
  if (r.status === "not-found") return TRACK_MISSING;
  revalidate(trackId);
  return { status: "ok", message: "أُعيد المسار إلى مسودة." };
}

export async function archiveTrackAction(trackId: string): Promise<ActionState> {
  await requireTrackAccess(trackId);
  const r = await archiveTrack(db, trackId);
  if (r.status === "not-found") return TRACK_MISSING;
  revalidate(trackId);
  return { status: "ok", message: "أُرشف المسار." };
}

// --------------------------------------------------------------- Task

export async function createTaskAction(
  trackId: string,
  input: { title: string; instructions: string; mode: "attest" | "review"; points: number },
): Promise<ActionState> {
  await requireTrackAccess(trackId);
  const r = await createTask(db, { trackId, ...input });
  switch (r.status) {
    case "created":
      revalidate(trackId);
      return { status: "ok", message: "أُنشئت المهمة كمسودة." };
    case "invalid-points":
      return { status: "error", message: "النقاط يجب أن تكون عدداً أكبر من صفر." };
    case "track-not-found":
      return { status: "error", message: "المسار غير موجود." };
  }
}

/** Resolve a Task's Track and gate on it, or refuse. Shared by every Task action. */
async function gateTask(taskId: string): Promise<{ trackId: string } | { error: ActionState }> {
  const trackId = await taskTrackId(db, taskId);
  if (!trackId) return { error: { status: "error", message: "المهمة غير موجودة." } };
  await requireTrackAccess(trackId);
  return { trackId };
}

export async function updateTaskAction(
  taskId: string,
  input: {
    title?: string;
    instructions?: string;
    mode?: "attest" | "review";
    points?: number;
  },
): Promise<ActionState> {
  const gate = await gateTask(taskId);
  if ("error" in gate) return gate.error;
  const r = await updateTask(db, taskId, input);
  if (r.status === "invalid-points") {
    return { status: "error", message: "النقاط يجب أن تكون عدداً أكبر من صفر." };
  }
  revalidate(gate.trackId);
  return { status: "ok", message: "حُفظت المهمة." };
}

export async function publishTaskAction(taskId: string): Promise<ActionState> {
  const gate = await gateTask(taskId);
  if ("error" in gate) return gate.error;
  await publishTask(db, taskId);
  revalidate(gate.trackId);
  return { status: "ok", message: "نُشرت المهمة." };
}

export async function archiveTaskAction(taskId: string): Promise<ActionState> {
  const gate = await gateTask(taskId);
  if ("error" in gate) return gate.error;
  await archiveTask(db, taskId);
  revalidate(gate.trackId);
  return { status: "ok", message: "أُرشفت المهمة." };
}

export async function deleteTaskAction(taskId: string): Promise<ActionState> {
  const gate = await gateTask(taskId);
  if ("error" in gate) return gate.error;
  const r = await deleteTask(db, taskId);
  if (r.status === "has-awards") {
    return { status: "error", message: "لا يمكن حذف مهمة نُقّطت — أرشفها بدلاً من ذلك." };
  }
  revalidate(gate.trackId);
  return { status: "ok", message: "حُذفت المهمة." };
}
