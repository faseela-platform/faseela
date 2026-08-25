"use server";

import { revalidatePath } from "next/cache";

import { updateServiceRequestStatus, type ServiceRequestStatus } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Triaging what people send through §37. Admin-only: a Service Request carries a
 * stranger's name and contact details, and it belongs to no Track, so there is no
 * supervisor scope that could own it — this is central administration (§34), gated
 * on the server like the other initiative-wide surfaces.
 */
export type TriageState = { status: "ok" | "error"; message: string };

export async function setRequestStatusAction(
  id: string,
  status: ServiceRequestStatus,
): Promise<TriageState> {
  const admin = await requireAdmin();
  /** Stamp who took it on, so a queue worked by several people stays legible. */
  const r = await updateServiceRequestStatus(db, id, { status, handledBy: admin.id });
  if (r.status === "not-found") return { status: "error", message: "الرسالة غير موجودة." };
  if (r.status === "invalid") return { status: "error", message: "حالة غير معروفة." };
  revalidatePath("/idara/tawasol");
  return { status: "ok", message: "حُدّثت الحالة." };
}
