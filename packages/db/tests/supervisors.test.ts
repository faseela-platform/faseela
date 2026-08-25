import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminMemberList,
  assignSupervisor,
  canManageTrackScope,
  createTrack,
  removeSupervisor,
  reviewQueue,
  roleOfUser,
  schema,
  setUserRole,
  updateTier,
  supervisorsOfTrack,
  tracksSupervisedBy,
  type Database,
} from "@faseela/db";

/**
 * Supervisor scope (§35), role + tier admin (§34), and the scoped review queue —
 * the authority side of the admin dashboard, against PGlite.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-03-15T12:00:00Z");
const SEASON = "22222222-2222-2222-2222-222222222222";

async function seedUser(id: string, role: "member" | "editor" | "admin" = "member") {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test`, role });
}
async function newTrack(slug: string) {
  const r = await createTrack(db, { slug, title: "مسار", summary: "و" }, at);
  if (r.status !== "created") throw new Error("track");
  return r.id;
}
async function seedTask(trackId: string, points = 20) {
  const [t] = await db
    .insert(schema.task)
    .values({
      trackId,
      title: "م",
      instructions: "x",
      mode: "review",
      points,
      state: "published",
      publishedAt: at,
    })
    .returning();
  return t!.id;
}
async function pendingSubmission(taskId: string, userId: string) {
  const [sub] = await db
    .insert(schema.submission)
    .values({ taskId, userId, state: "pending", createdAt: at })
    .returning();
  await db.insert(schema.submissionAttempt).values({
    submissionId: sub!.id,
    attemptNo: 1,
    submittedAt: at,
  });
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await db.insert(schema.season).values({
    id: SEASON,
    slug: "s",
    title: "موسم",
    startsAt: new Date("2026-03-01T00:00:00Z"),
    endsAt: new Date("2026-05-01T00:00:00Z"),
  });
});

describe("assignSupervisor / removeSupervisor", () => {
  it("assigns an editor to a track, idempotently", async () => {
    await seedUser("e1", "editor");
    const track = await newTrack("track-a");

    expect((await assignSupervisor(db, track, "e1")).status).toBe("assigned");
    /** Assigning again is a no-op, not a duplicate. */
    expect((await assignSupervisor(db, track, "e1")).status).toBe("already-assigned");

    expect((await supervisorsOfTrack(db, track)).map((s) => s.userId)).toEqual(["e1"]);
    expect(await tracksSupervisedBy(db, "e1")).toEqual([track]);
  });

  it("reports a missing track or user", async () => {
    await seedUser("e1", "editor");
    const track = await newTrack("track-a");
    expect((await assignSupervisor(db, "00000000-0000-0000-0000-000000000000", "e1")).status).toBe("track-not-found");
    expect((await assignSupervisor(db, track, "ghost")).status).toBe("user-not-found");
  });

  it("removes an assignment", async () => {
    await seedUser("e1", "editor");
    const track = await newTrack("track-a");
    await assignSupervisor(db, track, "e1");
    expect((await removeSupervisor(db, track, "e1")).status).toBe("removed");
    expect((await removeSupervisor(db, track, "e1")).status).toBe("not-assigned");
    expect(await tracksSupervisedBy(db, "e1")).toEqual([]);
  });
});

describe("canManageTrackScope (pure)", () => {
  it("an admin may manage any track; an editor only their assigned ones", () => {
    expect(canManageTrackScope("admin", [], "any-track")).toBe(true);
    expect(canManageTrackScope("editor", ["t1", "t2"], "t1")).toBe(true);
    expect(canManageTrackScope("editor", ["t1"], "t2")).toBe(false);
    expect(canManageTrackScope("member", ["t1"], "t1")).toBe(false);
  });
});

describe("setUserRole", () => {
  it("changes a user's role, read live", async () => {
    await seedUser("u1", "member");
    expect((await setUserRole(db, "u1", "editor")).status).toBe("updated");
    expect(await roleOfUser(db, "u1")).toBe("editor");
  });
  it("reports a missing user", async () => {
    expect((await setUserRole(db, "ghost", "admin")).status).toBe("no-such-user");
  });
});

describe("adminMemberList", () => {
  it("lists members with role and lifetime points, richest first", async () => {
    await seedUser("m1", "member");
    await seedUser("e1", "editor");
    const track = await newTrack("t");
    const taskId = await seedTask(track, 30);
    const [sub] = await db
      .insert(schema.submission)
      .values({ taskId, userId: "m1", state: "accepted" })
      .returning();
    await db.insert(schema.pointAward).values({
      userId: "m1",
      seasonId: SEASON,
      taskId,
      submissionId: sub!.id,
      points: 30,
      awardedAt: at,
    });

    const rows = await adminMemberList(db);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("m1")).toMatchObject({ role: "member", points: 30 });
    expect(byId.get("e1")).toMatchObject({ role: "editor", points: 0 });
    /** Highest lifetime points first. */
    expect(rows[0]!.id).toBe("m1");
  });
});

describe("updateTier", () => {
  it("edits a tier threshold and name atomically (§46)", async () => {
    expect((await updateTier(db, "special", { minPoints: 250, name: "متميّز" })).status).toBe(
      "updated",
    );
    const [row] = await db
      .select()
      .from(schema.memberTier)
      .where(eq(schema.memberTier.key, "special"));
    expect(row!.minPoints).toBe(250);
    expect(row!.name).toBe("متميّز");
  });
  it("edits either field alone", async () => {
    expect((await updateTier(db, "special", { minPoints: 300 })).status).toBe("updated");
    expect((await updateTier(db, "special", { name: "الخاصّة" })).status).toBe("updated");
  });
  it("refuses a negative threshold, an empty name, an empty update, and an unknown tier", async () => {
    expect((await updateTier(db, "special", { minPoints: -5 })).status).toBe("invalid");
    expect((await updateTier(db, "special", { name: "  " })).status).toBe("invalid");
    expect((await updateTier(db, "special", {})).status).toBe("invalid");
    expect((await updateTier(db, "nope", { minPoints: 10 })).status).toBe("not-found");
  });
});

describe("reviewQueue scoped to supervised tracks (§35)", () => {
  it("an admin (no scope) sees all; a supervisor sees only their tracks", async () => {
    await seedUser("m1", "member");
    await seedUser("m2", "member");
    const trackA = await newTrack("track-a");
    const trackB = await newTrack("track-b");
    await pendingSubmission(await seedTask(trackA), "m1");
    await pendingSubmission(await seedTask(trackB), "m2");

    /** Admin passes no scope → the whole queue. */
    expect(await reviewQueue(db)).toHaveLength(2);

    /** A supervisor of Track A only sees Track A's submission. */
    const scoped = await reviewQueue(db, [trackA]);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]!.taskId).not.toBeNull();
    expect((await reviewQueue(db, [])).length).toBe(0); // scoped to nothing → nothing
  });
});
