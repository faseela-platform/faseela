"use server";

import { revalidatePath } from "next/cache";

import {
  assignSupervisor,
  removeSupervisor,
  setUserRole,
  updateTier,
  type TierUpdate,
  type UserRole,
} from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Central-admin actions (spec §34): roles, supervisor assignment, tier thresholds.
 * Every one is `requireAdmin` first — these are global authority, not a supervisor's
 * scope. Rules live in `@faseela/db`; this authenticates, translates, revalidates.
 */
export type ActionState = { status: "ok" | "error"; message: string };

export async function setUserRoleAction(userId: string, role: UserRole): Promise<ActionState> {
  await requireAdmin();
  const r = await setUserRole(db, userId, role);
  if (r.status === "no-such-user") return { status: "error", message: "المستخدم غير موجود." };
  revalidatePath("/idara/aada");
  return { status: "ok", message: "حُدّث الدور." };
}

export async function assignSupervisorAction(trackId: string, userId: string): Promise<ActionState> {
  await requireAdmin();
  const r = await assignSupervisor(db, trackId, userId);
  switch (r.status) {
    case "assigned":
      revalidatePath("/idara/aada");
      revalidatePath(`/idara/masarat/${trackId}`);
      return { status: "ok", message: "عُيّن المشرف." };
    case "already-assigned":
      return { status: "error", message: "هو مشرف على هذا المسار سلفاً." };
    case "track-not-found":
      return { status: "error", message: "المسار غير موجود." };
    case "user-not-found":
      return { status: "error", message: "المستخدم غير موجود." };
  }
}

export async function removeSupervisorAction(trackId: string, userId: string): Promise<ActionState> {
  await requireAdmin();
  const r = await removeSupervisor(db, trackId, userId);
  if (r.status === "not-assigned") return { status: "error", message: "ليس مشرفاً على هذا المسار." };
  revalidatePath("/idara/aada");
  revalidatePath(`/idara/masarat/${trackId}`);
  return { status: "ok", message: "سُحب الإشراف." };
}

export async function updateTierAction(key: string, input: TierUpdate): Promise<ActionState> {
  await requireAdmin();
  const r = await updateTier(db, key, input);
  switch (r.status) {
    case "updated":
      revalidatePath("/idara/rutab");
      return { status: "ok", message: "حُفظت الرتبة." };
    case "invalid":
      return { status: "error", message: "الاسم مطلوب والحد صفر أو أكثر." };
    case "not-found":
      return { status: "error", message: "الرتبة غير موجودة." };
  }
}
