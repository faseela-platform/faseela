import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ANONYMISED_NAME,
  acceptSubmission,
  anonymiseMember,
  schema,
  seasonLeaderboard,
  submitWork,
  type Database,
} from "@faseela/db";

/**
 * Erasure, tested against real Postgres.
 *
 * The bug this file exists to prevent was invisible to twenty passing unit tests
 * and to `[✓] migrations applied successfully`: `point_award.user_id` was
 * `ON DELETE CASCADE`, so closing an account would have silently deleted that
 * Member's Points and quietly reordered finished Seasons' Leaderboards (ADR 0016).
 *
 * The reason it stayed invisible is that no test had ever deleted a user. So the
 * central assertion here is not that `anonymiseMember` works — it is that the
 * database *refuses the delete*, which is the guarantee everything else rests on.
 */

/** Read from disk in order, so a new migration is covered as soon as it exists. */
const migrationsDir = join(__dirname, "../migrations");
const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"));

let db: Database;

const SEASON = "22222222-2222-2222-2222-222222222222";
const inSeason = new Date("2026-03-15T12:00:00Z");

async function seedMember(id: string, name: string) {
  await db.insert(schema.user).values({
    id,
    name,
    email: `${id}@example.test`,
    emailVerified: true,
    image: "https://example.test/avatar.png",
    phoneNumber: `+9617${id.replace(/\D/g, "").padStart(5, "0").slice(0, 5)}`,
    phoneNumberVerified: true,
  });
}

/** An accepted Submission plus its minted award, so the member has a ledger. */
async function seedEarnedPoints(userId: string, points: number) {
  const [track] = await db
    .insert(schema.track)
    .values({
      slug: `tr-${Math.random().toString(36).slice(2, 8)}`,
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
      state: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })
    .returning();

  /** Points are minted only by an Editor accepting real work (§25), so seed one. */
  await db
    .insert(schema.user)
    .values({ id: "editor-seed", name: "محرّر", email: "editor-seed@example.test", role: "editor" })
    .onConflictDoNothing();

  const submitted = await submitWork(db, task!.id, userId, { body: "ملخص" }, inSeason);
  if (submitted.status !== "submitted") throw new Error("seed submit failed");
  const result = await acceptSubmission(
    db,
    submitted.submissionId,
    "editor-seed",
    points,
    inSeason,
  );
  expect(result.status).toBe("accepted");
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;

  for (const file of sqlFiles) {
    for (const statement of file.split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (sql) await db.execute(sql);
    }
  }

  await db.insert(schema.season).values({
    id: SEASON,
    slug: "spring-2026",
    title: "موسم الربيع",
    startsAt: new Date("2026-03-01T00:00:00Z"),
    endsAt: new Date("2026-04-01T00:00:00Z"),
  });
});

describe("the ledger's referential guarantee", () => {
  /**
   * This is the regression test for the actual bug. If someone reintroduces
   * `onDelete: "cascade"` on `point_award.user_id`, this test fails and nothing
   * else in the suite does.
   */
  it("refuses to delete a Member who has earned Points", async () => {
    await seedMember("m1", "أحمد");
    await seedEarnedPoints("m1", 5);

    /**
     * Asserted primarily on SQLSTATE `23001`, which is `restrict_violation`
     * specifically — not the broader `23503` (`foreign_key_violation`) that a bad
     * insert would also raise. Only the narrow code proves RESTRICT is the thing
     * doing the work.
     *
     * Drizzle wraps the driver error, so the cause is unwrapped first. The
     * constraint is then checked in the message rather than as a field, because
     * PGlite and node-postgres disagree on whether it is `constraint` or
     * `constraint_name`, and this suite must pass on both.
     */
    let raised: { code?: string; message?: string } = {};
    try {
      await db.delete(schema.user).where(eq(schema.user.id, "m1"));
    } catch (err) {
      raised = ((err as { cause?: unknown }).cause ?? err) as typeof raised;
    }

    expect(raised.code).toBe("23001");
    expect(raised.message).toContain("point_award_user_id_user_id_fk");

    const awards = await db.select().from(schema.pointAward);
    expect(awards).toHaveLength(1);
  });

  /**
   * The converse. A Member who never earned anything has nothing to protect, and
   * making that case impossible too would be gratuitous.
   */
  it("allows deleting a Member who has earned nothing", async () => {
    await seedMember("m2", "ليلى");
    await db.delete(schema.user).where(eq(schema.user.id, "m2"));

    const rows = await db.select().from(schema.user);
    expect(rows).toHaveLength(0);
  });
});

describe("anonymiseMember", () => {
  it("scrubs every identifying column and stamps the date", async () => {
    await seedMember("m1", "أحمد");
    await seedEarnedPoints("m1", 5);

    const at = new Date("2026-05-01T09:00:00Z");
    const result = await anonymiseMember(db, "m1", at);
    expect(result).toEqual({ status: "anonymised", at });

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, "m1"));

    expect(row).toMatchObject({
      name: ANONYMISED_NAME,
      emailVerified: false,
      image: null,
      phoneNumber: null,
      phoneNumberVerified: false,
      anonymisedAt: at,
    });

    /**
     * `email` is NOT NULL UNIQUE so it cannot be blanked. Asserting the shape
     * rather than the literal keeps this honest: what matters is that no real
     * address survives and that the value can never be delivered to — `.invalid`
     * is reserved by RFC 2606 for exactly that.
     */
    expect(row!.email).not.toContain("example.test");
    expect(row!.email).toMatch(/@faseela\.invalid$/);
  });

  it("keeps the Points and the Leaderboard rank intact", async () => {
    await seedMember("m1", "أحمد");
    await seedMember("m2", "ليلى");
    await seedEarnedPoints("m1", 10);
    await seedEarnedPoints("m2", 3);

    const before = await seasonLeaderboard(db, SEASON);
    await anonymiseMember(db, "m1");
    const after = await seasonLeaderboard(db, SEASON);

    /** Same ranks, same totals — only the name changes. */
    expect(after.map((r) => [r.rank, r.points])).toEqual(before.map((r) => [r.rank, r.points]));
    expect(after[0]).toMatchObject({ rank: 1, points: 10, name: ANONYMISED_NAME });
    expect(after[1]).toMatchObject({ rank: 2, points: 3, name: "ليلى" });
  });

  it("revokes every session and credential", async () => {
    await seedMember("m1", "أحمد");

    await db.insert(schema.session).values({
      id: "s1",
      token: "tok-1",
      userId: "m1",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });
    await db.insert(schema.account).values({
      id: "a1",
      userId: "m1",
      accountId: "m1",
      providerId: "credential",
    });

    await anonymiseMember(db, "m1");

    expect(await db.select().from(schema.session)).toHaveLength(0);
    expect(await db.select().from(schema.account)).toHaveLength(0);
  });

  /**
   * Erasure requests arrive by email, get forwarded, and get actioned twice. The
   * second run must return the *first* date, because that date is the evidence of
   * when the obligation was discharged.
   */
  it("is idempotent and preserves the original erasure date", async () => {
    await seedMember("m1", "أحمد");

    const first = new Date("2026-05-01T09:00:00Z");
    const later = new Date("2026-06-01T09:00:00Z");

    await anonymiseMember(db, "m1", first);
    const second = await anonymiseMember(db, "m1", later);

    expect(second).toEqual({ status: "already-anonymised", at: first });

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, "m1"));
    expect(row!.anonymisedAt).toEqual(first);
  });

  it("reports an unknown Member rather than throwing", async () => {
    expect(await anonymiseMember(db, "nobody")).toEqual({ status: "no-such-member" });
  });

  /**
   * Two erased members must not collide on `email`, which is the failure mode a
   * blanked or constant placeholder would produce — and it would only appear the
   * second time erasure was ever used in production.
   */
  it("gives two erased Members distinct emails", async () => {
    await seedMember("m1", "أحمد");
    await seedMember("m2", "ليلى");

    await anonymiseMember(db, "m1");
    await anonymiseMember(db, "m2");

    const rows = await db.select({ email: schema.user.email }).from(schema.user);
    expect(new Set(rows.map((r) => r.email)).size).toBe(2);
  });
});
