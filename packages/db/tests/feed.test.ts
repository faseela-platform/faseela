import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createContentItem,
  createTrack,
  feedItems,
  memberHomeTasks,
  publishContentItem,
  schema,
  type Database,
} from "@faseela/db";

/**
 * The public Feed read (§3) and the home task zone (§3.1), against PGlite. The Feed
 * shows only published content, newest first, one merged stream; the home task zone
 * shows a Member's live work (draft/returned/pending) and nothing closed.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const t1 = new Date("2026-03-01T00:00:00Z");
const t2 = new Date("2026-03-02T00:00:00Z");
const t3 = new Date("2026-03-03T00:00:00Z");

async function seedUser(id: string, role: "member" | "editor" | "admin" = "admin") {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test`, role });
}
async function newTrack(slug: string) {
  const r = await createTrack(db, { slug, title: `مسار-${slug}`, summary: "و" }, t1);
  if (r.status !== "created") throw new Error("track");
  return r.id;
}
async function publish(opts: { type?: "news" | "product"; trackId?: string; when: Date }) {
  const r = await createContentItem(
    db,
    { type: opts.type ?? "news", title: "عنوان", body: "نص", trackId: opts.trackId, createdBy: "author" },
    opts.when,
  );
  if (r.status !== "created") throw new Error(r.status);
  await publishContentItem(db, r.id, opts.when);
  return r.id;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await seedUser("author", "admin");
});

describe("feedItems", () => {
  it("returns only published content, newest first, carrying the Track link when scoped", async () => {
    const trackId = await newTrack("t");
    await publish({ when: t1, trackId }); // oldest, track-scoped
    const mid = await publish({ when: t2 }); // track-less
    await publish({ when: t3 }); // newest
    // a draft must not appear
    await createContentItem(db, { type: "news", title: "مسودة", body: "x", createdBy: "author" }, t2);

    const feed = await feedItems(db);
    expect(feed.length).toBe(3);
    expect(feed.map((f) => f.publishedAt)).toEqual([t3, t2, t1]); // reverse-chron
    const scoped = feed.find((f) => f.publishedAt.getTime() === t1.getTime())!;
    expect(scoped.trackSlug).toBe("t");
    expect(scoped.trackTitle).toBe("مسار-t");
    const trackless = feed.find((f) => f.id === mid)!;
    expect(trackless.trackSlug).toBeNull();
  });

  it("paginates with before, and honours limit", async () => {
    await publish({ when: t1 });
    await publish({ when: t2 });
    await publish({ when: t3 });

    expect((await feedItems(db, { limit: 2 })).map((f) => f.publishedAt)).toEqual([t3, t2]);
    expect((await feedItems(db, { before: t2 })).map((f) => f.publishedAt)).toEqual([t1]);
  });
});

describe("memberHomeTasks", () => {
  it("returns live work (draft/returned/pending) with task+track, newest first; hides closed", async () => {
    await seedUser("m", "member");
    const trackId = await newTrack("reading");

    /** One Submission per (Task, Member) — the unique index — so each state is its own Task. */
    async function taskWithSubmission(
      title: string,
      state: "draft" | "returned" | "pending" | "accepted",
      updatedAt: Date,
    ) {
      const [tk] = await db
        .insert(schema.task)
        .values({ trackId, title, instructions: "x", mode: "review", points: 10 })
        .returning();
      await db
        .insert(schema.submission)
        .values({ taskId: tk!.id, userId: "m", state, createdAt: t1, updatedAt });
    }

    await taskWithSubmission("مقبولة", "accepted", t3); // closed — must be hidden
    await taskWithSubmission("لخّص الفصل", "pending", t2);
    await taskWithSubmission("اكتب مقالاً", "draft", t3);

    const tasks = await memberHomeTasks(db, "m");
    expect(tasks.map((t) => t.taskTitle)).toEqual(["اكتب مقالاً", "لخّص الفصل"]); // newest updatedAt first
    expect(tasks.map((t) => t.submissionState)).toEqual(["draft", "pending"]);
    expect(tasks[0]!.trackSlug).toBe("reading");
  });
});
