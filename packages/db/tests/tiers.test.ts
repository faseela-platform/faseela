import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  memberLifetimePoints,
  memberProgress,
  memberTrackPoints,
  schema,
  tierForPoints,
  tierThresholds,
  type Database,
  type Tier,
} from "@faseela/db";

/**
 * The permission ladder (spec §45–49), against PGlite. The tiers are seeded by the
 * migration, so the same ladder the product ships with is the one under test. The
 * point of these is the two rules the spec turns on: tier is **lifetime** (sums
 * across Seasons, unlike the Leaderboard), and it is **derived on read** from the
 * ledger (editing a threshold re-tiers everyone, no migration).
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;

const SEASON_A = "22222222-2222-2222-2222-222222222222";
const SEASON_B = "33333333-3333-3333-3333-333333333333";

async function seedMember(id: string, name = "عضو") {
  await db.insert(schema.user).values({ id, name, email: `${id}@example.test` });
}

async function seedTrack(slug: string, title = "مسار") {
  const [t] = await db
    .insert(schema.track)
    .values({
      slug,
      title,
      summary: "وصف",
      state: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })
    .returning();
  return t!;
}

async function seedTask(trackId: string, points: number) {
  const [t] = await db
    .insert(schema.task)
    .values({
      trackId,
      title: "مهمة",
      instructions: "اقرأ",
      mode: "attest",
      points,
      state: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })
    .returning();
  return t!;
}

/** An accepted Submission + its minted award, in a chosen Season — one per Task. */
async function award(userId: string, taskId: string, seasonId: string, points: number) {
  const [sub] = await db
    .insert(schema.submission)
    .values({ taskId, userId, state: "accepted" })
    .returning();
  await db.insert(schema.pointAward).values({
    userId,
    seasonId,
    taskId,
    submissionId: sub!.id,
    points,
    awardedAt: new Date("2026-03-15T12:00:00Z"),
  });
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await db.insert(schema.season).values([
    {
      id: SEASON_A,
      slug: "2026-a",
      title: "موسم أ",
      startsAt: new Date("2026-03-01T00:00:00Z"),
      endsAt: new Date("2026-05-01T00:00:00Z"),
    },
    {
      id: SEASON_B,
      slug: "2026-b",
      title: "موسم ب",
      startsAt: new Date("2026-05-01T00:00:00Z"),
      endsAt: new Date("2026-07-01T00:00:00Z"),
    },
  ]);
});

/** A hand-built ladder, independent of the seed, for the pure-function tests. */
const LADDER: Tier[] = [
  { key: "visitor", name: "زائر", minPoints: 0, position: 0 },
  { key: "general", name: "عام", minPoints: 100, position: 1 },
  { key: "special", name: "خاص", minPoints: 200, position: 2 },
  { key: "advanced", name: "متقدم", minPoints: 500, position: 3 },
  { key: "faseeli", name: "فسيلي", minPoints: 1000, position: 4 },
];

describe("tierForPoints", () => {
  it("returns the highest rung a Points total meets", () => {
    expect(tierForPoints(0, LADDER)?.key).toBe("visitor");
    expect(tierForPoints(99, LADDER)?.key).toBe("visitor");
    expect(tierForPoints(100, LADDER)?.key).toBe("general");
    expect(tierForPoints(250, LADDER)?.key).toBe("special");
    expect(tierForPoints(999, LADDER)?.key).toBe("advanced");
    expect(tierForPoints(1000, LADDER)?.key).toBe("faseeli");
    expect(tierForPoints(999_999, LADDER)?.key).toBe("faseeli");
  });

  it("does not assume the ladder is sorted", () => {
    const shuffled = [...LADDER].reverse();
    expect(tierForPoints(250, shuffled)?.key).toBe("special");
  });

  it("returns null for an empty ladder", () => {
    expect(tierForPoints(50, [])).toBeNull();
  });
});

describe("tierThresholds", () => {
  it("returns the seeded ladder, low rung to high", async () => {
    const tiers = await tierThresholds(db);
    expect(tiers.map((t) => t.key)).toEqual([
      "visitor",
      "general",
      "special",
      "advanced",
      "faseeli",
    ]);
    expect(tiers[0]!.minPoints).toBe(0);
    expect(tiers[4]!.minPoints).toBe(1000);
    /** Arabic names survive the round-trip. */
    expect(tiers[1]!.name).toBe("عام");
  });
});

describe("memberLifetimePoints", () => {
  it("sums across every Season, unlike season points", async () => {
    await seedMember("m1");
    const a = await seedTask((await seedTrack("t-a")).id, 20);
    const b = await seedTask((await seedTrack("t-b")).id, 30);
    await award("m1", a.id, SEASON_A, 20);
    /** A different Season — the Leaderboard would not count this toward Season A. */
    await award("m1", b.id, SEASON_B, 30);

    expect(await memberLifetimePoints(db, "m1")).toBe(50);
  });

  it("is zero for a Member who has earned nothing", async () => {
    await seedMember("m2");
    expect(await memberLifetimePoints(db, "m2")).toBe(0);
  });
});

describe("memberTrackPoints", () => {
  it("breaks Points down by Track, highest first", async () => {
    await seedMember("m1");
    const trackA = await seedTrack("track-a", "المسار أ");
    const trackB = await seedTrack("track-b", "المسار ب");
    await award("m1", (await seedTask(trackA.id, 20)).id, SEASON_A, 20);
    await award("m1", (await seedTask(trackA.id, 30)).id, SEASON_A, 30);
    await award("m1", (await seedTask(trackB.id, 40)).id, SEASON_B, 40);

    const rows = await memberTrackPoints(db, "m1");
    expect(rows).toHaveLength(2);
    /** Track A (50) sums two Tasks across the join and outranks Track B (40). */
    expect(rows[0]).toMatchObject({ trackSlug: "track-a", trackTitle: "المسار أ", points: 50 });
    expect(rows[1]).toMatchObject({ trackSlug: "track-b", points: 40 });
  });

  it("is empty for a Member who has earned nothing", async () => {
    await seedMember("m2");
    expect(await memberTrackPoints(db, "m2")).toEqual([]);
  });
});

describe("memberProgress", () => {
  it("reports tier, lifetime Points, the next rung and the gap to it", async () => {
    await seedMember("m1");
    const t = await seedTask((await seedTrack("t-a")).id, 150);
    await award("m1", t.id, SEASON_A, 150);

    const s = await memberProgress(db, "m1");
    expect(s.tier.key).toBe("general"); // 150 ≥ 100
    expect(s.points).toBe(150);
    expect(s.nextTier?.key).toBe("special"); // 200
    expect(s.pointsToNext).toBe(50); // 200 − 150
  });

  it("has no next rung at the top of the ladder", async () => {
    await seedMember("m1");
    const t = await seedTask((await seedTrack("t-a")).id, 1200);
    await award("m1", t.id, SEASON_A, 1200);

    const s = await memberProgress(db, "m1");
    expect(s.tier.key).toBe("faseeli");
    expect(s.nextTier).toBeNull();
    expect(s.pointsToNext).toBeNull();
  });

  it("places a Member who has earned nothing at the floor tier", async () => {
    await seedMember("m2");
    const s = await memberProgress(db, "m2");
    expect(s.tier.key).toBe("visitor");
    expect(s.points).toBe(0);
    expect(s.nextTier?.key).toBe("general");
    expect(s.pointsToNext).toBe(100);
  });
});
