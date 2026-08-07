import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Imported through the package entry point, not `../lib/*`, because that is the
 * surface consumers actually get — a test that reaches past it can pass while
 * the package is unusable. Enforced by dependency-cruiser's
 * `tests-through-entrypoints` rule.
 */
import { awardPoints, schema, seasonLeaderboard, type Database } from "@faseela/db";

/**
 * These run against PGlite — real Postgres compiled to WASM — not a mock.
 *
 * That choice is the point of the file. Every invariant being tested here is
 * enforced *by Postgres*: two unique indexes, six check constraints, and the
 * ordering guarantee of a window function. A mocked database would assert that
 * our code calls the right methods, which is precisely the thing that does not
 * matter; what matters is that the database refuses the write.
 *
 * The migration SQL is applied as generated, so a schema change that drops a
 * constraint fails here rather than in production.
 */

/**
 * Every migration, in order, rather than `0000_init.sql` alone.
 *
 * Reading the directory rather than listing files by hand is deliberate: the
 * first version of this pinned one filename, so when `0001` added a column the
 * suite tested a schema that no longer existed anywhere. `readdir` + sort means
 * a new migration is picked up by the tests the moment it is generated, which is
 * the only arrangement where a green suite says anything about production.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;

async function seedMember(id: string, name: string) {
  await db.insert(schema.user).values({ id, name, email: `${id}@example.test` });
}

async function seedSeason(id: string, startsAt: Date, endsAt: Date) {
  await db
    .insert(schema.season)
    .values({ id, slug: `s-${id.slice(0, 8)}`, title: "موسم", startsAt, endsAt });
}

async function seedTask(points: number) {
  const [track] = await db
    .insert(schema.track)
    .values({
      slug: `t-${Math.random().toString(36).slice(2, 8)}`,
      title: "مسار",
      summary: "وصف",
    })
    .returning();

  const [task] = await db
    .insert(schema.task)
    .values({
      trackId: track!.id,
      title: "مهمة",
      instructions: "اقرأ",
      mode: "review",
      points,
    })
    .returning();

  return task!;
}

async function seedAcceptedSubmission(taskId: string, userId: string) {
  const [row] = await db
    .insert(schema.submission)
    .values({ taskId, userId, body: "ملخص", state: "accepted" })
    .returning();
  return row!;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;

  /**
   * drizzle-kit separates statements with a marker comment rather than bare
   * semicolons, because a semicolon can appear inside a check constraint body.
   */
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
});

describe("awardPoints", () => {
  const inSeason = new Date("2026-03-15T12:00:00Z");

  beforeEach(async () => {
    await seedSeason(
      "11111111-1111-1111-1111-111111111111",
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-04-01T00:00:00Z"),
    );
  });

  it("mints once and is idempotent on retry", async () => {
    await seedMember("m1", "أحمد");
    const task = await seedTask(5);
    const submission = await seedAcceptedSubmission(task.id, "m1");

    const first = await awardPoints(db, submission.id, inSeason);
    expect(first.status).toBe("awarded");

    const second = await awardPoints(db, submission.id, inSeason);
    expect(second.status).toBe("already-awarded");

    /** Same award, not a second one. */
    expect(second).toMatchObject({
      awardId: first.status === "awarded" ? first.awardId : "",
      points: 5,
    });

    const all = await db.select().from(schema.pointAward);
    expect(all).toHaveLength(1);
  });

  it("refuses to mint for a Submission that is not accepted", async () => {
    await seedMember("m2", "زينب");
    const task = await seedTask(5);
    const [pending] = await db
      .insert(schema.submission)
      .values({ taskId: task.id, userId: "m2", body: "ملخص" })
      .returning();

    const result = await awardPoints(db, pending!.id, inSeason);
    expect(result.status).toBe("not-accepted");
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
  });

  it("refuses to mint outside a Season rather than inventing one", async () => {
    await seedMember("m3", "حسن");
    const task = await seedTask(5);
    const submission = await seedAcceptedSubmission(task.id, "m3");

    const outside = new Date("2026-05-01T00:00:00Z");
    const result = await awardPoints(db, submission.id, outside);

    expect(result.status).toBe("no-season");
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
  });

  it("freezes the point value, so editing the Task does not rewrite history", async () => {
    await seedMember("m4", "فاطمة");
    const task = await seedTask(5);
    const submission = await seedAcceptedSubmission(task.id, "m4");

    await awardPoints(db, submission.id, inSeason);

    /** An Editor doubles the Task's worth afterwards. */
    await db.update(schema.task).set({ points: 10 }).where(eq(schema.task.id, task.id));

    const [award] = await db.select().from(schema.pointAward);
    expect(award!.points).toBe(5);
  });
});

describe("submission uniqueness", () => {
  it("rejects a second Submission from the same Member for the same Task", async () => {
    await seedMember("m5", "علي");
    const task = await seedTask(3);
    await seedAcceptedSubmission(task.id, "m5");

    /**
     * Drizzle wraps driver errors in a `Failed query:` message and keeps the
     * original on `cause`, so asserting on the thrown message alone would pass
     * for *any* insert failure — including a typo in the fixture. The constraint
     * name is checked on the cause, so this test can only pass because Postgres
     * refused the duplicate.
     */
    const error = await seedAcceptedSubmission(task.id, "m5").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    const cause = (error as Error).cause as { code?: string; constraint?: string } | undefined;

    /** 23505 is unique_violation. */
    expect(cause?.code).toBe("23505");
    expect(cause?.constraint).toBe("submission_task_user_unique");
  });
});

describe("seasonLeaderboard", () => {
  const seasonId = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    await seedSeason(seasonId, new Date("2026-03-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"));
  });

  it("breaks ties on who reached the total first, and shares the rank when equal", async () => {
    await seedMember("early", "سارة");
    await seedMember("late", "مريم");

    const task = await seedTask(10);
    const taskB = await seedTask(10);

    const a = await seedAcceptedSubmission(task.id, "early");
    const b = await seedAcceptedSubmission(taskB.id, "late");

    await awardPoints(db, a.id, new Date("2026-03-02T00:00:00Z"));
    await awardPoints(db, b.id, new Date("2026-03-20T00:00:00Z"));

    const board = await seasonLeaderboard(db, seasonId);

    expect(board.map((r) => r.userId)).toEqual(["early", "late"]);
    /**
     * Equal Points share a rank — RANK, not ROW_NUMBER. The order between them
     * is still deterministic (earliest first), which is what stops a Member
     * appearing to move between two loads of the same page.
     */
    expect(board.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("counts only the Season asked for", async () => {
    const other = "33333333-3333-3333-3333-333333333333";
    await seedSeason(other, new Date("2026-04-01T00:00:00Z"), new Date("2026-05-01T00:00:00Z"));

    await seedMember("m6", "كريم");
    const t1 = await seedTask(7);
    const t2 = await seedTask(9);
    const s1 = await seedAcceptedSubmission(t1.id, "m6");
    const s2 = await seedAcceptedSubmission(t2.id, "m6");

    await awardPoints(db, s1.id, new Date("2026-03-10T00:00:00Z"));
    await awardPoints(db, s2.id, new Date("2026-04-10T00:00:00Z"));

    const march = await seasonLeaderboard(db, seasonId);
    expect(march[0]!.points).toBe(7);

    const april = await seasonLeaderboard(db, other);
    expect(april[0]!.points).toBe(9);
  });
});
