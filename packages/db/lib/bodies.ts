import type { Database } from "./client";
import { initiativeBody } from "./content";

/**
 * برامج التأهيل وهيئات الإنتاج (§2) — the initiative's non-Track bodies, for the
 * admin's picker when general news speaks for one of them (§32). Position order:
 * programs first, then production bodies, as §2 lists them.
 */
export type InitiativeBodyRow = {
  id: string;
  name: string;
  kind: "program" | "production_body";
};

export async function listBodies(db: Database): Promise<InitiativeBodyRow[]> {
  return db
    .select({ id: initiativeBody.id, name: initiativeBody.name, kind: initiativeBody.kind })
    .from(initiativeBody)
    .orderBy(initiativeBody.position);
}
