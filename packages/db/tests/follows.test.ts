import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createTrack,
  followTrack,
  followedTrackIds,
  publishTrack,
  schema,
  trackFollowerCounts,
  unfollowTrack,
  type Database,
} from "@faseela/db";

/**
 * متابعة المسار (§10) — the explicit follow relation. The seam under test is the
 * four public functions; the home's zone 2, the followed-first Tracks page and
 * the notification audience all build on these.
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
async function publishedTrack(slug: string) {
  const r = await createTrack(db, { slug, title: "مسار", summary: "و" }, at);
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
});

describe("followTrack", () => {
  it("a Member follows a published Track and it appears in their followed set", async () => {
    await seedUser("u1");
    const trackId = await publishedTrack("t1");

    expect(await followTrack(db, "u1", trackId)).toEqual({ status: "followed" });
    expect(await followedTrackIds(db, "u1")).toEqual(new Set([trackId]));
  });

  it("following twice is a no-op, not a duplicate (§11: the button hides once following)", async () => {
    await seedUser("u1");
    const trackId = await publishedTrack("t1");

    await followTrack(db, "u1", trackId);
    expect(await followTrack(db, "u1", trackId)).toEqual({ status: "already-following" });
    expect((await followedTrackIds(db, "u1")).size).toBe(1);
  });

  it("an unknown or unpublished Track cannot be followed — indistinguishably (like trackBySlug)", async () => {
    await seedUser("u1");
    const draft = await createTrack(db, { slug: "d1", title: "مسار", summary: "و" }, at);
    if (draft.status !== "created") throw new Error("track");

    expect(await followTrack(db, "u1", draft.id)).toEqual({ status: "not-found" });
    expect(await followTrack(db, "u1", "00000000-0000-0000-0000-000000000000")).toEqual({
      status: "not-found",
    });
    expect((await followedTrackIds(db, "u1")).size).toBe(0);
  });
});

describe("unfollowTrack", () => {
  it("unfollowing removes the Track from the followed set", async () => {
    await seedUser("u1");
    const trackId = await publishedTrack("t1");
    await followTrack(db, "u1", trackId);

    expect(await unfollowTrack(db, "u1", trackId)).toEqual({ status: "unfollowed" });
    expect((await followedTrackIds(db, "u1")).size).toBe(0);
  });

  it("unfollowing a Track never followed is a stated no-op", async () => {
    await seedUser("u1");
    const trackId = await publishedTrack("t1");

    expect(await unfollowTrack(db, "u1", trackId)).toEqual({ status: "not-following" });
  });
});

describe("working in a Track follows it", () => {
  it("an attest auto-follows — the old audience guarantee holds forever, not just at backfill", async () => {
    const { attestTask, schema: s } = await import("@faseela/db");
    await seedUser("u1");
    const trackId = await publishedTrack("t1");
    const [task] = await db
      .insert(s.task)
      .values({
        trackId,
        title: "م",
        instructions: "x",
        mode: "attest",
        points: 10,
        state: "published",
        publishedAt: at,
      })
      .returning();
    await db.insert(s.season).values({
      slug: "s",
      title: "الموسم",
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2027-01-01T00:00:00Z"),
    });

    await attestTask(db, task!.id, "u1", at);
    expect(await followedTrackIds(db, "u1")).toEqual(new Set([trackId]));
  });

  it("but an unfollow is respected — attesting again does not re-subscribe silently…", async () => {
    /**
     * …because re-following on every later action would make unfollow a lie for
     * anyone still active in the Track. Work follows once; the Member's explicit
     * unfollow outranks it.
     */
    const { attestTask, schema: s } = await import("@faseela/db");
    await seedUser("u1");
    const trackId = await publishedTrack("t1");
    const mk = async (title: string) => {
      const [t] = await db
        .insert(s.task)
        .values({
          trackId,
          title,
          instructions: "x",
          mode: "attest",
          points: 10,
          state: "published",
          publishedAt: at,
        })
        .returning();
      return t!.id;
    };
    await db.insert(s.season).values({
      slug: "s",
      title: "الموسم",
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2027-01-01T00:00:00Z"),
    });

    await attestTask(db, await mk("أ"), "u1", at);
    await unfollowTrack(db, "u1", trackId);
    await attestTask(db, await mk("ب"), "u1", at);
    expect((await followedTrackIds(db, "u1")).size).toBe(0);
  });
});

describe("trackFollowerCounts", () => {
  it("counts followers per Track, zero included (§11: the count shows on the Track page)", async () => {
    await seedUser("u1");
    await seedUser("u2");
    const a = await publishedTrack("a");
    const b = await publishedTrack("b");
    await followTrack(db, "u1", a);
    await followTrack(db, "u2", a);
    await followTrack(db, "u1", b);
    const lonely = await publishedTrack("c");

    const counts = await trackFollowerCounts(db, [a, b, lonely]);
    expect(counts.get(a)).toBe(2);
    expect(counts.get(b)).toBe(1);
    expect(counts.get(lonely)).toBe(0);
  });
});
