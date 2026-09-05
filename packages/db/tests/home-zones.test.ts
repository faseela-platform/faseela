import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createContentItem,
  createTrack,
  discoveryTracks,
  followTrack,
  followedTracksWithLatest,
  publishContentItem,
  publishTrack,
  schema,
  type Database,
} from "@faseela/db";

/**
 * The home's remaining zones (§3): zone 2 — the Member's followed Tracks with
 * their latest word — and zone 5 — simple discovery: published Tracks the Member
 * does NOT follow (owner decision 2026-09-01: the honest version now, the smart
 * recommender stays deferred as §3 allows).
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-09-02T12:00:00Z");

async function seedUser(id: string, role: "member" | "editor" = "member") {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test`, role });
}
async function publishedTrack(slug: string, position: number) {
  const r = await createTrack(db, { slug, title: `مسار-${slug}`, summary: "و", position }, at);
  if (r.status !== "created") throw new Error("track");
  await publishTrack(db, r.id, at);
  return r.id;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await seedUser("editor", "editor");
});

describe("followedTracksWithLatest — zone 2", () => {
  it("lists the followed Tracks with each one's latest published word, position order", async () => {
    await seedUser("u1");
    const a = await publishedTrack("a", 1);
    const b = await publishedTrack("b", 2);
    await publishedTrack("unfollowed", 3);
    await followTrack(db, "u1", a);
    await followTrack(db, "u1", b);

    const older = await createContentItem(
      db,
      { type: "product", title: "قديم", body: "ن", trackId: a, createdBy: "editor" },
      new Date("2026-09-01T09:00:00Z"),
    );
    if (older.status !== "created") throw new Error();
    await publishContentItem(db, older.id, new Date("2026-09-01T09:00:00Z"));
    const newer = await createContentItem(
      db,
      { type: "cultural", title: "أحدث", body: "ن", trackId: a, createdBy: "editor" },
      at,
    );
    if (newer.status !== "created") throw new Error();
    await publishContentItem(db, newer.id, at);

    const zone2 = await followedTracksWithLatest(db, "u1");
    expect(zone2.map((t) => t.slug)).toEqual(["a", "b"]);
    expect(zone2[0]!.latest?.title).toBe("أحدث");
    /** A followed Track with nothing published yet still appears — followed is followed. */
    expect(zone2[1]!.latest).toBeNull();
  });
});

describe("discoveryTracks — zone 5", () => {
  it("offers the published Tracks the Member does not follow, and hides drafts", async () => {
    await seedUser("u1");
    const a = await publishedTrack("a", 1);
    await publishedTrack("b", 2);
    const draft = await createTrack(db, { slug: "d", title: "مسودة", summary: "و" }, at);
    if (draft.status !== "created") throw new Error();
    await followTrack(db, "u1", a);

    expect((await discoveryTracks(db, "u1")).map((t) => t.slug)).toEqual(["b"]);
  });

  it("with nothing followed it offers everything published — the visitor's اكتشف", async () => {
    await seedUser("u1");
    await publishedTrack("a", 1);
    await publishedTrack("b", 2);

    expect((await discoveryTracks(db, "u1")).map((t) => t.slug)).toEqual(["a", "b"]);
  });
});
