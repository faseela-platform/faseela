import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminTrack,
  adminTracks,
  archiveTask,
  archiveTrack,
  createTask,
  createTrack,
  deleteTask,
  publishTask,
  publishTrack,
  schema,
  unpublishTrack,
  updateTask,
  updateTrack,
  type Database,
} from "@faseela/db";

/**
 * The admin content layer (spec §34/§35) — how a supervisor authors Tracks and
 * Tasks, replacing the raw-SQL seed. Against PGlite, because the load-bearing rules
 * are database constraints: a published Track/Task MUST carry a `published_at`
 * (the biconditional CHECK), Points must be positive, slugs unique, and a Task with
 * awards cannot be deleted (the ledger's RESTRICT).
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-03-15T12:00:00Z");

const trackRow = (id: string) =>
  db
    .select()
    .from(schema.track)
    .where(eq(schema.track.id, id))
    .then((r) => r[0]!);
const taskRow = (id: string) =>
  db
    .select()
    .from(schema.task)
    .where(eq(schema.task.id, id))
    .then((r) => r[0]!);

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
});

async function newTrack(slug = "a-track") {
  const r = await createTrack(db, { slug, title: "مسار", summary: "وصف" }, at);
  if (r.status !== "created") throw new Error(`createTrack: ${r.status}`);
  return r.id;
}

describe("createTrack", () => {
  it("creates a draft with no publish date", async () => {
    const r = await createTrack(db, { slug: "reading-groups", title: "حلقات", summary: "وصف" }, at);
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    const row = await trackRow(r.id);
    expect(row.state).toBe("draft");
    /** A draft must NOT carry a publish date — the biconditional CHECK. */
    expect(row.publishedAt).toBeNull();
    expect(row.title).toBe("حلقات");
  });

  it("rejects a non-Latin or malformed slug", async () => {
    expect((await createTrack(db, { slug: "حلقات", title: "x", summary: "y" }, at)).status).toBe(
      "invalid-slug",
    );
    expect(
      (await createTrack(db, { slug: "Has Space", title: "x", summary: "y" }, at)).status,
    ).toBe("invalid-slug");
  });

  it("rejects a duplicate slug", async () => {
    await newTrack("reading-groups");
    expect(
      (await createTrack(db, { slug: "reading-groups", title: "x", summary: "y" }, at)).status,
    ).toBe("slug-taken");
  });
});

describe("publishTrack / archiveTrack / unpublishTrack", () => {
  it("publishing stamps the date; archiving and unpublishing clear it", async () => {
    const id = await newTrack();

    expect((await publishTrack(db, id, at)).status).toBe("published");
    let row = await trackRow(id);
    expect(row.state).toBe("published");
    expect(row.publishedAt).not.toBeNull(); // the CHECK requires this

    expect((await archiveTrack(db, id, at)).status).toBe("archived");
    row = await trackRow(id);
    expect(row.state).toBe("archived");
    expect(row.publishedAt).toBeNull();

    await publishTrack(db, id, at);
    expect((await unpublishTrack(db, id, at)).status).toBe("unpublished");
    row = await trackRow(id);
    expect(row.state).toBe("draft");
    expect(row.publishedAt).toBeNull();
  });

  it("keeps the original publish date when re-published", async () => {
    const id = await newTrack();
    const first = new Date("2026-03-01T00:00:00Z");
    await publishTrack(db, id, first);
    /** Re-publishing later must not reset the date — history would move. */
    await publishTrack(db, id, new Date("2026-06-01T00:00:00Z"));
    expect((await trackRow(id)).publishedAt?.toISOString()).toBe(first.toISOString());
  });

  it("reports a missing Track rather than throwing", async () => {
    expect((await publishTrack(db, "00000000-0000-0000-0000-000000000000", at)).status).toBe(
      "not-found",
    );
  });
});

describe("updateTrack", () => {
  it("edits fields", async () => {
    const id = await newTrack();
    expect((await updateTrack(db, id, { title: "عنوان جديد", position: 3 }, at)).status).toBe(
      "updated",
    );
    const row = await trackRow(id);
    expect(row.title).toBe("عنوان جديد");
    expect(row.position).toBe(3);
  });

  it("refuses to collide a slug with another Track", async () => {
    await newTrack("track-a");
    const b = await newTrack("track-b");
    expect((await updateTrack(db, b, { slug: "track-a" }, at)).status).toBe("slug-taken");
  });
});

describe("createTask / publishTask / archiveTask", () => {
  it("creates a draft Task under a Track", async () => {
    const trackId = await newTrack();
    const r = await createTask(
      db,
      { trackId, title: "مهمة", instructions: "اقرأ", mode: "review", points: 50 },
      at,
    );
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    const row = await taskRow(r.id);
    expect(row.state).toBe("draft");
    expect(row.publishedAt).toBeNull();
    expect(row.points).toBe(50);
    expect(row.mode).toBe("review");
  });

  it("a Task created without a position joins the END of the road (owner, 2026-09-05)", async () => {
    /** The admin form never asks for a position; the seam must place the new Task
     * after every existing one — not at the top, where a default of 0 lands it. */
    const trackId = await newTrack();
    await createTask(
      db,
      { trackId, title: "أولى", instructions: "و", mode: "attest", points: 10, position: 1 },
      at,
    );
    await createTask(
      db,
      { trackId, title: "ثانية", instructions: "و", mode: "attest", points: 10 },
      at,
    );
    await createTask(
      db,
      { trackId, title: "ثالثة", instructions: "و", mode: "attest", points: 10 },
      at,
    );

    const admin = await adminTrack(db, trackId);
    expect(admin!.tasks.map((t) => t.title)).toEqual(["أولى", "ثانية", "ثالثة"]);
  });

  it("refuses non-positive Points and an unknown Track", async () => {
    const trackId = await newTrack();
    expect(
      (
        await createTask(
          db,
          { trackId, title: "م", instructions: "x", mode: "attest", points: 0 },
          at,
        )
      ).status,
    ).toBe("invalid-points");
    expect(
      (
        await createTask(
          db,
          {
            trackId: "00000000-0000-0000-0000-000000000000",
            title: "م",
            instructions: "x",
            mode: "attest",
            points: 5,
          },
          at,
        )
      ).status,
    ).toBe("track-not-found");
  });

  it("publishing a Task stamps the date; archiving clears it", async () => {
    const trackId = await newTrack();
    const c = await createTask(
      db,
      { trackId, title: "م", instructions: "x", mode: "attest", points: 20 },
      at,
    );
    if (c.status !== "created") throw new Error("create failed");

    expect((await publishTask(db, c.id, at)).status).toBe("published");
    expect((await taskRow(c.id)).publishedAt).not.toBeNull();
    expect((await archiveTask(db, c.id, at)).status).toBe("archived");
    expect((await taskRow(c.id)).publishedAt).toBeNull();
  });
});

describe("deleteTask", () => {
  it("deletes a Task that has no awards", async () => {
    const trackId = await newTrack();
    const c = await createTask(
      db,
      { trackId, title: "م", instructions: "x", mode: "attest", points: 20 },
      at,
    );
    if (c.status !== "created") throw new Error("create failed");
    expect((await deleteTask(db, c.id)).status).toBe("deleted");
    expect(await db.select().from(schema.task)).toHaveLength(0);
  });

  it("refuses to delete a Task that has awards — it must be archived", async () => {
    const trackId = await newTrack();
    const c = await createTask(
      db,
      { trackId, title: "م", instructions: "x", mode: "attest", points: 20 },
      at,
    );
    if (c.status !== "created") throw new Error("create failed");
    /** An accepted Submission + its award, so the Task's ledger RESTRICT bites. */
    await db.insert(schema.user).values({ id: "m1", name: "عضو", email: "m1@example.test" });
    await db.insert(schema.season).values({
      id: "22222222-2222-2222-2222-222222222222",
      slug: "s",
      title: "موسم",
      startsAt: new Date("2026-03-01T00:00:00Z"),
      endsAt: new Date("2026-05-01T00:00:00Z"),
    });
    const [sub] = await db
      .insert(schema.submission)
      .values({ taskId: c.id, userId: "m1", state: "accepted" })
      .returning();
    await db.insert(schema.pointAward).values({
      userId: "m1",
      seasonId: "22222222-2222-2222-2222-222222222222",
      taskId: c.id,
      submissionId: sub!.id,
      points: 20,
      awardedAt: at,
    });

    expect((await deleteTask(db, c.id)).status).toBe("has-awards");
    /** The Task survives, so the award's foreign key stays valid. */
    expect(await db.select().from(schema.task)).toHaveLength(1);
  });
});

describe("adminTracks / adminTrack (drafts visible)", () => {
  it("lists every Track regardless of state, with task counts", async () => {
    const draftId = await newTrack("draft-one");
    const pubId = await newTrack("published-one");
    await publishTrack(db, pubId, at);
    await createTask(
      db,
      { trackId: pubId, title: "م", instructions: "x", mode: "review", points: 50 },
      at,
    );

    const rows = await adminTracks(db);
    /** Unlike `publishedTracks`, the draft appears too — an authoring list sees all. */
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    expect(bySlug.has("draft-one")).toBe(true);
    expect(bySlug.has("published-one")).toBe(true);
    expect(bySlug.get("published-one")!.taskCount).toBe(1);
    expect(bySlug.get("draft-one")!.taskCount).toBe(0);
    expect(bySlug.get("draft-one")!.state).toBe("draft");
    void draftId;
  });

  it("returns one Track with all its Tasks, any state", async () => {
    const id = await newTrack();
    const t1 = await createTask(
      db,
      { trackId: id, title: "منشورة", instructions: "x", mode: "attest", points: 20 },
      at,
    );
    if (t1.status === "created") await publishTask(db, t1.id, at);
    await createTask(
      db,
      { trackId: id, title: "مسودة", instructions: "y", mode: "review", points: 50 },
      at,
    );

    const detail = await adminTrack(db, id);
    expect(detail).not.toBeNull();
    expect(detail!.tasks).toHaveLength(2);
    /** A draft Task is visible to the admin (the public read would hide it). */
    expect(detail!.tasks.some((t) => t.state === "draft")).toBe(true);
  });

  it("returns null for an unknown Track", async () => {
    expect(await adminTrack(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
