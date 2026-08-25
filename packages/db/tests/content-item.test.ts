import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminContentItem,
  adminContentItems,
  archiveContentItem,
  assignSupervisor,
  createContentItem,
  createTrack,
  contentTrackId,
  deleteContentItem,
  publishContentItem,
  schema,
  unpublishContentItem,
  updateContentItem,
  type Database,
} from "@faseela/db";

/**
 * The unified content entity (§33) authoring layer — against PGlite because the
 * load-bearing rules are database constraints: a published piece MUST carry a
 * `published_at` (the biconditional CHECK), and the supervisor scope is a SQL
 * `exists` over `track_supervisor`.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-03-15T12:00:00Z");

const row = (id: string) =>
  db.select().from(schema.contentItem).where(eq(schema.contentItem.id, id)).then((r) => r[0]!);

async function seedUser(id: string, role: "member" | "editor" | "admin" = "editor") {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test`, role });
}
async function newTrack(slug: string) {
  const r = await createTrack(db, { slug, title: "مسار", summary: "و" }, at);
  if (r.status !== "created") throw new Error("track");
  return r.id;
}
async function seedTask(trackId: string) {
  const [t] = await db
    .insert(schema.task)
    .values({ trackId, title: "م", instructions: "x", mode: "review", points: 10 })
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
  await seedUser("author", "admin");
});

const base = { type: "news" as const, title: "عنوان", body: "نص", createdBy: "author" };

describe("createContentItem", () => {
  it("creates a draft with no publish date (track-less)", async () => {
    const r = await createContentItem(db, base, at);
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    const c = await row(r.id);
    expect(c.state).toBe("draft");
    expect(c.publishedAt).toBeNull();
    expect(c.trackId).toBeNull();
  });

  it("creates track-scoped content pointing at a Track and a Task", async () => {
    const trackId = await newTrack("t");
    const taskId = await seedTask(trackId);
    const r = await createContentItem(
      db,
      { ...base, type: "product", trackId, taskId, mediaKey: "content/x/y.png" },
      at,
    );
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    const c = await row(r.id);
    expect(c.trackId).toBe(trackId);
    expect(c.taskId).toBe(taskId);
    expect(c.mediaKey).toBe("content/x/y.png");
  });

  it("refuses empty title/body, an unknown Track, and an unknown Task", async () => {
    expect((await createContentItem(db, { ...base, title: "  " }, at)).status).toBe("invalid");
    expect((await createContentItem(db, { ...base, body: "" }, at)).status).toBe("invalid");
    const bad = "00000000-0000-0000-0000-000000000000";
    expect((await createContentItem(db, { ...base, trackId: bad }, at)).status).toBe(
      "track-not-found",
    );
    expect((await createContentItem(db, { ...base, taskId: bad }, at)).status).toBe(
      "task-not-found",
    );
  });
});

describe("publish / archive / unpublish", () => {
  it("publishing stamps the date; archiving and unpublishing clear it", async () => {
    const r = await createContentItem(db, base, at);
    if (r.status !== "created") throw new Error();

    expect((await publishContentItem(db, r.id, at)).status).toBe("published");
    let c = await row(r.id);
    expect(c.state).toBe("published");
    expect(c.publishedAt).toEqual(at);

    expect((await archiveContentItem(db, r.id, at)).status).toBe("archived");
    c = await row(r.id);
    expect(c.state).toBe("archived");
    expect(c.publishedAt).toBeNull();

    await publishContentItem(db, r.id, at);
    expect((await unpublishContentItem(db, r.id, at)).status).toBe("unpublished");
    c = await row(r.id);
    expect(c.state).toBe("draft");
    expect(c.publishedAt).toBeNull();
  });

  it("keeps the original publish date when re-published", async () => {
    const r = await createContentItem(db, base, at);
    if (r.status !== "created") throw new Error();
    await publishContentItem(db, r.id, at);
    /** Re-publishing an already-published piece must not reset the date — history
     * would move (archiving/unpublishing first clears it, so that path is a fresh
     * publication; this is the exact rule `setTrackState` enforces). */
    await publishContentItem(db, r.id, new Date("2026-06-01T00:00:00Z"));
    expect((await row(r.id)).publishedAt).toEqual(at);
  });

  it("reports a missing piece rather than throwing", async () => {
    const bad = "00000000-0000-0000-0000-000000000000";
    expect((await publishContentItem(db, bad, at)).status).toBe("not-found");
  });
});

describe("updateContentItem", () => {
  it("edits fields and can make a piece track-less by clearing the track", async () => {
    const trackId = await newTrack("t");
    const r = await createContentItem(db, { ...base, trackId }, at);
    if (r.status !== "created") throw new Error();

    expect((await updateContentItem(db, r.id, { title: "جديد", trackId: null }, at)).status).toBe(
      "updated",
    );
    const c = await row(r.id);
    expect(c.title).toBe("جديد");
    expect(c.trackId).toBeNull();
  });

  it("refuses an empty title, an unknown Track, and a missing piece", async () => {
    const r = await createContentItem(db, base, at);
    if (r.status !== "created") throw new Error();
    const bad = "00000000-0000-0000-0000-000000000000";
    expect((await updateContentItem(db, r.id, { title: " " }, at)).status).toBe("invalid");
    expect((await updateContentItem(db, r.id, { trackId: bad }, at)).status).toBe("track-not-found");
    expect((await updateContentItem(db, bad, { title: "x" }, at)).status).toBe("not-found");
  });
});

describe("deleteContentItem", () => {
  it("deletes a piece, and reports a missing one", async () => {
    const r = await createContentItem(db, base, at);
    if (r.status !== "created") throw new Error();
    expect((await deleteContentItem(db, r.id)).status).toBe("deleted");
    expect(await adminContentItem(db, r.id)).toBeNull();
    expect((await deleteContentItem(db, r.id)).status).toBe("not-found");
  });
});

describe("contentTrackId", () => {
  it("distinguishes track-scoped, track-less, and missing", async () => {
    const trackId = await newTrack("t");
    const scoped = await createContentItem(db, { ...base, trackId }, at);
    const trackless = await createContentItem(db, base, at);
    if (scoped.status !== "created" || trackless.status !== "created") throw new Error();

    expect(await contentTrackId(db, scoped.id)).toEqual({ trackId });
    expect(await contentTrackId(db, trackless.id)).toEqual({ trackId: null });
    expect(await contentTrackId(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("adminContentItems", () => {
  it("lists all states newest-first; a supervisor sees only their track's content", async () => {
    await seedUser("sup", "editor");
    const mine = await newTrack("mine");
    const other = await newTrack("other");
    await assignSupervisor(db, mine, "sup");

    // one draft on the supervised track, one on another, one track-less (admin-only)
    const a = await createContentItem(db, { ...base, trackId: mine }, at);
    await createContentItem(db, { ...base, trackId: other }, at);
    await createContentItem(db, base, at);
    if (a.status !== "created") throw new Error();

    const asAdmin = await adminContentItems(db);
    expect(asAdmin.length).toBe(3);

    const asSup = await adminContentItems(db, { supervisorId: "sup" });
    expect(asSup.map((c) => c.id)).toEqual([a.id]);
    expect(asSup[0]!.trackTitle).toBe("مسار");
  });
});
