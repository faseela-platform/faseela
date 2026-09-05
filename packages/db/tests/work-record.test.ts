import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  attestTask,
  createTrack,
  memberWorkRecord,
  publishTrack,
  saveDraft,
  schema,
  submitWork,
  type Database,
} from "@faseela/db";

/**
 * سجل أعمالي (§30 addition, owner decision 2026-09-01) — the Member's own record:
 * what they completed (from the ledger — the source of truth for earned Points)
 * and where their open work stands. Personal only; nothing social.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-09-02T12:00:00Z");

async function seedUser(id: string) {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test` });
}
async function seedSeason() {
  await db.insert(schema.season).values({
    slug: "s",
    title: "الموسم",
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2027-01-01T00:00:00Z"),
  });
}
async function publishedTrack(slug: string) {
  const r = await createTrack(db, { slug, title: `مسار-${slug}`, summary: "و" }, at);
  if (r.status !== "created") throw new Error("track");
  await publishTrack(db, r.id, at);
  return r.id;
}
async function publishedTask(trackId: string, title: string, mode: "attest" | "review") {
  const [t] = await db
    .insert(schema.task)
    .values({
      trackId,
      title,
      instructions: "x",
      mode,
      points: 30,
      state: "published",
      publishedAt: at,
    })
    .returning();
  return t!.id;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await seedUser("u1");
  await seedSeason();
});

describe("memberWorkRecord", () => {
  it("completed work comes from the ledger — task, Track and the points actually minted", async () => {
    const trackId = await publishedTrack("reading");
    const taskId = await publishedTask(trackId, "حضور الجلسة", "attest");
    await attestTask(db, taskId, "u1", at);

    const record = await memberWorkRecord(db, "u1");
    expect(record.completed).toHaveLength(1);
    expect(record.completed[0]).toMatchObject({
      taskTitle: "حضور الجلسة",
      trackSlug: "reading",
      points: 30,
    });
    expect(record.submissions).toHaveLength(0);
  });

  it("open work shows with its true state — a draft and a pending submission", async () => {
    const trackId = await publishedTrack("reading");
    const draftTask = await publishedTask(trackId, "تلخيص", "review");
    const pendingTask = await publishedTask(trackId, "اقتباسات", "review");
    await saveDraft(db, draftTask, "u1", { body: "مسودة" }, at);
    await submitWork(db, pendingTask, "u1", { body: "عملي" }, at);

    const record = await memberWorkRecord(db, "u1");
    expect(record.completed).toHaveLength(0);
    const byTitle = new Map(record.submissions.map((s) => [s.taskTitle, s.state]));
    expect(byTitle.get("تلخيص")).toBe("draft");
    expect(byTitle.get("اقتباسات")).toBe("pending");
  });

  it("someone else's work never leaks into the record", async () => {
    await seedUser("u2");
    const trackId = await publishedTrack("reading");
    const taskId = await publishedTask(trackId, "حضور", "attest");
    await attestTask(db, taskId, "u2", at);

    const record = await memberWorkRecord(db, "u1");
    expect(record.completed).toHaveLength(0);
    expect(record.submissions).toHaveLength(0);
  });
});
