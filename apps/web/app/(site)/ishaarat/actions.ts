"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { markNotificationsSeen } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Mark everything read (§3: «حتى لا يكرر عرضه»).
 *
 * An action rather than a write inside the page's render: a GET that mutates is a page
 * that clears your badge when a crawler, a prefetch or a back-button touches it. Here
 * the Member says they have read them.
 */
export async function markAllSeenAction(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return;

  await markNotificationsSeen(db, session.user.id);
  revalidatePath("/ishaarat");
}
