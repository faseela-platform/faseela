import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  attestTask,
  completedTaskIds,
  memberSeasonPoints,
  schema,
  seasonLeaderboard,
  type Database,
} from "@faseela/db";

/**
 * Against PGlite — real Postgres in WASM — for the same reason as review.test.ts:
 * every guarantee here is enforced by a constraint, and a mock would only prove
 * our code calls the methods we told it to.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;

const SEASON_ID = "22222222-2222-2222-2222-222222222222";
const inSeason = new Date("2026-03-15T12:00:00Z");

async function seedMember(id: string, name = "عضو") {
  await db.insert(schema.user).values({ id, name, email: `${id}@example.test` });
}

async function seedTask(opts: {
  mode: "attest" | "review";
  points: number;
  state?: "draft" | "published";
}) {
  const [track] = await db
    .insert(schema.track)
    .values({
      slug: `t-${Math.random().toString(36).slice(2, 8)}`,
      title: "مسار",
      summary: "وصف",
      state: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })
    .returning();

  const state = opts.state ?? "published";
  const [task] = await db
    .insert(schema.task)
    .values({
      trackId: track!.id,
      title: "مهمة",
      instructions: "اقرأ",
      mode: opts.mode,
      points: opts.points,
      state,
      /** The task_published_has_date CHECK ties these two together. */
      publishedAt: state === "published" ? new Date("2026-01-01T00:00:00Z") : null,
    })
    .returning();

  return task!;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;

  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }

  await db.insert(schema.season).values({
    id: SEASON_ID,
    slug: "2026-03",
    title: "موسم",
    startsAt: new Date("2026-03-01T00:00:00Z"),
    endsAt: new Date("2026-05-01T00:00:00Z"),
  });
});

describe("attestTask", () => {
  it("mints Points and records an accepted Submission with no reviewer", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20 });

    const result = await attestTask(db, task.id, "m1", inSeason);

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.points).toBe(20);

    const [sub] = await db
      .select()
      .from(schema.submission)
      .where(eq(schema.submission.id, result.submissionId));

    expect(sub!.state).toBe("accepted");
    /**
     * The heart of the attest model: accepted, but by nobody. Recording the
     * Member as their own reviewer would make the review queue's own counts lie
     * about how much work Editors had examined.
     */
    expect(sub!.reviewedBy).toBeNull();
    expect(sub!.reviewedAt).toBeNull();
    /** Nothing was submitted, so `body` must be null rather than empty string. */
    expect(sub!.body).toBeNull();

    const awards = await db.select().from(schema.pointAward);
    expect(awards).toHaveLength(1);
    expect(awards[0]!.seasonId).toBe(SEASON_ID);
    expect(awards[0]!.points).toBe(20);
  });

  it("is idempotent: a second attempt mints nothing and returns the first award", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20 });

    const first = await attestTask(db, task.id, "m1", inSeason);
    const second = await attestTask(db, task.id, "m1", inSeason);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("already-completed");
    if (first.status !== "completed" || second.status !== "already-completed") return;

    /** Same award, not a second one — this is the double-tap guarantee. */
    expect(second.awardId).toBe(first.awardId);
    expect(second.points).toBe(20);

    const awards = await db.select().from(schema.pointAward);
    expect(awards).toHaveLength(1);

    const subs = await db.select().from(schema.submission);
    expect(subs).toHaveLength(1);
  });

  it("refuses a review Task, so unreviewed work can never self-mint", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    const result = await attestTask(db, task.id, "m1", inSeason);

    expect(result.status).toBe("not-attestable");
    /** Nothing at all was written — not a pending Submission, not an award. */
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
    expect(await db.select().from(schema.submission)).toHaveLength(0);
  });

  it("refuses a draft Task, so Members cannot bank next Season's Tasks early", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20, state: "draft" });

    const result = await attestTask(db, task.id, "m1", inSeason);

    expect(result.status).toBe("not-published");
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
    expect(await db.select().from(schema.submission)).toHaveLength(0);
  });

  it("refuses to mint outside a Season rather than inventing one", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20 });

    const outside = new Date("2026-06-15T12:00:00Z");
    const result = await attestTask(db, task.id, "m1", outside);

    expect(result.status).toBe("no-season");
    expect(await db.select().from(schema.submission)).toHaveLength(0);
  });

  it("lets two Members complete the same Task independently", async () => {
    await seedMember("m1", "أحمد");
    await seedMember("m2", "علي");
    const task = await seedTask({ mode: "attest", points: 20 });

    const a = await attestTask(db, task.id, "m1", inSeason);
    const b = await attestTask(db, task.id, "m2", inSeason);

    expect(a.status).toBe("completed");
    expect(b.status).toBe("completed");
    expect(await db.select().from(schema.pointAward)).toHaveLength(2);
  });

  it("freezes the award at the Task's value when earned", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20 });

    await attestTask(db, task.id, "m1", inSeason);

    /** An Editor doubles the Task's worth afterwards. */
    await db.update(schema.task).set({ points: 40 }).where(eq(schema.task.id, task.id));

    const awards = await db.select().from(schema.pointAward);
    /**
     * ADR 0015. If this read 40, every past Leaderboard would silently reorder
     * whenever an Editor retuned a Task.
     */
    expect(awards[0]!.points).toBe(20);
  });

  it("feeds the Leaderboard, which ranks ties as equal", async () => {
    await seedMember("m1", "أحمد");
    await seedMember("m2", "علي");
    const t20 = await seedTask({ mode: "attest", points: 20 });
    const t30 = await seedTask({ mode: "attest", points: 30 });

    await attestTask(db, t20.id, "m1", inSeason);
    await attestTask(db, t30.id, "m1", inSeason);
    await attestTask(db, t20.id, "m2", inSeason);

    const board = await seasonLeaderboard(db, SEASON_ID);

    expect(board).toHaveLength(2);
    expect(board[0]!.points).toBe(50);
    expect(board[0]!.rank).toBe(1);
    expect(board[1]!.points).toBe(20);
    expect(board[1]!.rank).toBe(2);
    /** Arabic names survive the aggregate join. */
    expect(board[0]!.name).toBe("أحمد");
  });
});

describe("completedTaskIds", () => {
  it("reports only this Member's completions, scoped to the Tasks asked about", async () => {
    await seedMember("m1");
    await seedMember("m2");
    const a = await seedTask({ mode: "attest", points: 20 });
    const b = await seedTask({ mode: "attest", points: 20 });
    const c = await seedTask({ mode: "attest", points: 20 });

    await attestTask(db, a.id, "m1", inSeason);
    await attestTask(db, b.id, "m2", inSeason);

    const done = await completedTaskIds(db, "m1", [a.id, b.id, c.id]);

    expect(done.has(a.id)).toBe(true);
    /** m2's completion must not appear as m1's. */
    expect(done.has(b.id)).toBe(false);
    expect(done.has(c.id)).toBe(false);
    expect(done.size).toBe(1);
  });

  it("returns empty for no Tasks without querying", async () => {
    expect((await completedTaskIds(db, "m1", [])).size).toBe(0);
  });
});

describe("memberSeasonPoints", () => {
  it("sums the ledger and stays scoped to one Season", async () => {
    await seedMember("m1");
    const a = await seedTask({ mode: "attest", points: 20 });
    const b = await seedTask({ mode: "attest", points: 30 });

    await attestTask(db, a.id, "m1", inSeason);
    await attestTask(db, b.id, "m1", inSeason);

    expect(await memberSeasonPoints(db, "m1", SEASON_ID)).toBe(50);

    /**
     * A different Season must report zero, because CONTEXT.md says Points earned
     * in one Season never carry into the next.
     */
    const other = "33333333-3333-3333-3333-333333333333";
    await db.insert(schema.season).values({
      id: other,
      slug: "2026-05",
      title: "موسم",
      startsAt: new Date("2026-05-01T00:00:00Z"),
      endsAt: new Date("2026-07-01T00:00:00Z"),
    });

    expect(await memberSeasonPoints(db, "m1", other)).toBe(0);
  });
});
