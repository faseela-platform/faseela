import { toApiWorkRecord, type WorkRecordResponse } from "@faseela/api-types";
import { memberWorkRecord } from "@faseela/db";

import { apiSessionUser, err, ok } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/record` — سجل أعمالي (§30 addition): the Member's own completed
 * work (from the ledger, the §8 source of truth) and their open submissions with
 * true states. Private per Member — never cached.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await apiSessionUser();
  if (!user) return err("unauthenticated", "سجّل دخولك أولاً.", 401);
  const record = await memberWorkRecord(db, user.id);
  return ok<WorkRecordResponse>(toApiWorkRecord(record));
}
