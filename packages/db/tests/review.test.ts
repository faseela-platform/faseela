import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  acceptSubmission,
  cancelDraft,
  completedTaskIds,
  memberSeasonPoints,
  memberSubmissions,
  rejectSubmission,
  returnSubmission,
  reviewQueue,
  saveDraft,
  schema,
  submissionForReview,
  submitWork,
  type Database,
} from "@faseela/db";

/**
 * The review workflow (spec §16–§26), against PGlite — real Postgres in WASM —
 * because every guarantee here (one submission per member per task, an attempt
 * log that is never overwritten, graded Points frozen at accept) is a database
 * constraint, and a mock would only prove our code calls what we told it to.
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

/** An Editor is a `user` with a staff role — the whole point of the Payload removal. */
async function seedEditor(id: string, name = "محرّر", role: "editor" | "admin" = "editor") {
  await db.insert(schema.user).values({ id, name, email: `${id}@example.test`, role });
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
      instructions: "اكتب",
      mode: opts.mode,
      points: opts.points,
      state,
      publishedAt: state === "published" ? new Date("2026-01-01T00:00:00Z") : null,
    })
    .returning();

  return task!;
}

const attemptsOf = (submissionId: string) =>
  db
    .select()
    .from(schema.submissionAttempt)
    .where(eq(schema.submissionAttempt.submissionId, submissionId))
    .orderBy(asc(schema.submissionAttempt.attemptNo));

const submissionRow = (id: string) =>
  db
    .select()
    .from(schema.submission)
    .where(eq(schema.submission.id, id))
    .then((r) => r[0]!);

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

describe("submitWork", () => {
  it("records a pending Submission and its first attempt", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    const result = await submitWork(db, task.id, "m1", { body: "مقالتي" }, inSeason);

    expect(result.status).toBe("submitted");
    if (result.status !== "submitted") return;
    expect(result.attemptNo).toBe(1);

    const sub = await submissionRow(result.submissionId);
    expect(sub.state).toBe("pending");
    expect(sub.body).toBe("مقالتي");
    /** Pending, so by nobody yet — the reviewed_together CHECK holds. */
    expect(sub.reviewedBy).toBeNull();
    expect(sub.reviewedAt).toBeNull();

    const attempts = await attemptsOf(result.submissionId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.body).toBe("مقالتي");
    expect(attempts[0]!.decision).toBeNull();
    /** No Points until an Editor accepts — this is the whole reason review exists. */
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
  });

  it("refuses an attest Task, which mints on the Member's own action instead", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "attest", points: 20 });

    const result = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);

    expect(result.status).toBe("not-reviewable");
    expect(await db.select().from(schema.submission)).toHaveLength(0);
  });

  it("refuses a draft Task", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50, state: "draft" });

    const result = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);

    expect(result.status).toBe("not-published");
    expect(await db.select().from(schema.submission)).toHaveLength(0);
  });

  it("refuses a second submission while the first is still under review", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    await submitWork(db, task.id, "m1", { body: "first" }, inSeason);
    const again = await submitWork(db, task.id, "m1", { body: "second" }, inSeason);

    expect(again.status).toBe("already-pending");
    /** No second attempt row was written behind the Editor's back. */
    const [sub] = await db.select().from(schema.submission);
    expect(await attemptsOf(sub!.id)).toHaveLength(1);
  });
});

describe("saveDraft", () => {
  it("saves a draft that carries no attempt and mints nothing", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    const result = await saveDraft(db, task.id, "m1", { body: "مسوّدة" }, inSeason);

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    const sub = await submissionRow(result.submissionId);
    expect(sub.state).toBe("draft");
    expect(sub.body).toBe("مسوّدة");
    /** A draft is not a submission: nothing is in the review queue or the log. */
    expect(await attemptsOf(result.submissionId)).toHaveLength(0);
    expect(await reviewQueue(db)).toHaveLength(0);
  });

  it("overwrites the working copy on each save (auto-save, §21)", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    await saveDraft(db, task.id, "m1", { body: "first" }, inSeason);
    await saveDraft(db, task.id, "m1", { body: "second" }, inSeason);

    const [sub] = await db.select().from(schema.submission);
    expect(sub!.body).toBe("second");
    expect(await db.select().from(schema.submission)).toHaveLength(1);
  });

  it("promotes to pending when the draft is submitted", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });

    const draft = await saveDraft(db, task.id, "m1", { body: "مسوّدة" }, inSeason);
    if (draft.status !== "saved") throw new Error("draft failed");
    const submitted = await submitWork(db, task.id, "m1", { body: "نهائي" }, inSeason);

    expect(submitted.status).toBe("submitted");
    if (submitted.status !== "submitted") return;
    /** The same single row: one submission per member per task. */
    expect(submitted.submissionId).toBe(draft.submissionId);
    const sub = await submissionRow(draft.submissionId);
    expect(sub.state).toBe("pending");
    expect(await attemptsOf(draft.submissionId)).toHaveLength(1);
  });
});

describe("cancelDraft", () => {
  it("closes a draft without it counting as a rejection", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });
    await saveDraft(db, task.id, "m1", { body: "مسوّدة" }, inSeason);

    const result = await cancelDraft(db, task.id, "m1", inSeason);

    expect(result.status).toBe("cancelled");
    const [sub] = await db.select().from(schema.submission);
    expect(sub!.state).toBe("cancelled");
  });

  it("refuses to cancel something already under review", async () => {
    await seedMember("m1");
    const task = await seedTask({ mode: "review", points: 50 });
    await submitWork(db, task.id, "m1", { body: "x" }, inSeason);

    const result = await cancelDraft(db, task.id, "m1", inSeason);
    expect(result.status).toBe("not-a-draft");
  });
});

describe("acceptSubmission", () => {
  it("mints graded Points at or below the Task's maximum and stamps the attempt", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const submitted = await submitWork(db, task.id, "m1", { body: "مقالة" }, inSeason);
    if (submitted.status !== "submitted") throw new Error("submit failed");

    /** The Editor grades it 40 of a possible 50 — §25. */
    const result = await acceptSubmission(db, submitted.submissionId, "e1", 40, inSeason);

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.points).toBe(40);

    const sub = await submissionRow(submitted.submissionId);
    expect(sub.state).toBe("accepted");
    expect(sub.reviewedBy).toBe("e1");
    expect(sub.reviewedAt).not.toBeNull();

    const [attempt] = await attemptsOf(submitted.submissionId);
    expect(attempt!.decision).toBe("accepted");
    expect(attempt!.earnedPoints).toBe(40);
    expect(attempt!.reviewedBy).toBe("e1");

    const awards = await db.select().from(schema.pointAward);
    expect(awards).toHaveLength(1);
    expect(awards[0]!.points).toBe(40);
    expect(awards[0]!.seasonId).toBe(SEASON_ID);
    expect(await memberSeasonPoints(db, "m1", SEASON_ID)).toBe(40);
  });

  it("refuses to grade above the Task's maximum", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const submitted = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);
    if (submitted.status !== "submitted") throw new Error("submit failed");

    const result = await acceptSubmission(db, submitted.submissionId, "e1", 51, inSeason);
    expect(result.status).toBe("invalid-points");
    /** Nothing minted, submission still pending. */
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
    expect((await submissionRow(submitted.submissionId)).state).toBe("pending");
  });

  it("refuses a reviewer who is not staff, so a Member cannot accept their own work", async () => {
    await seedMember("m1");
    await seedMember("m2");
    const task = await seedTask({ mode: "review", points: 50 });
    const submitted = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);
    if (submitted.status !== "submitted") throw new Error("submit failed");

    const result = await acceptSubmission(db, submitted.submissionId, "m2", 10, inSeason);
    expect(result.status).toBe("not-an-editor");
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);
  });

  it("freezes the award at the graded value even if the Task's worth changes later", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const submitted = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);
    if (submitted.status !== "submitted") throw new Error("submit failed");

    await acceptSubmission(db, submitted.submissionId, "e1", 40, inSeason);
    await db.update(schema.task).set({ points: 10 }).where(eq(schema.task.id, task.id));

    const awards = await db.select().from(schema.pointAward);
    /** ADR 0015: the graded value is frozen; lowering the Task cannot claw it back. */
    expect(awards[0]!.points).toBe(40);
  });

  it("refuses to accept anything that is not pending", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    await saveDraft(db, task.id, "m1", { body: "مسوّدة" }, inSeason);
    const [sub] = await db.select().from(schema.submission);

    const result = await acceptSubmission(db, sub!.id, "e1", 10, inSeason);
    expect(result.status).toBe("not-pending");
  });
});

describe("returnSubmission then resubmit (§24, §26)", () => {
  it("returns with a note, keeps the first attempt, and logs the revision as a new attempt", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const first = await submitWork(db, task.id, "m1", { body: "المحاولة الأولى" }, inSeason);
    if (first.status !== "submitted") throw new Error("submit failed");

    const returned = await returnSubmission(db, first.submissionId, "e1", "وسّع الخاتمة", inSeason);
    expect(returned.status).toBe("returned");

    let sub = await submissionRow(first.submissionId);
    expect(sub.state).toBe("returned");
    expect(sub.reviewNote).toBe("وسّع الخاتمة");

    /** The Member revises and resubmits. */
    const later = new Date("2026-03-16T12:00:00Z");
    const second = await submitWork(db, task.id, "m1", { body: "المحاولة الثانية" }, later);
    expect(second.status).toBe("submitted");
    if (second.status !== "submitted") return;
    expect(second.submissionId).toBe(first.submissionId);
    expect(second.attemptNo).toBe(2);

    sub = await submissionRow(first.submissionId);
    expect(sub.state).toBe("pending");

    const attempts = await attemptsOf(first.submissionId);
    expect(attempts).toHaveLength(2);
    /** §26: the first attempt and its note survive untouched. */
    expect(attempts[0]!.body).toBe("المحاولة الأولى");
    expect(attempts[0]!.decision).toBe("returned");
    expect(attempts[0]!.reviewNote).toBe("وسّع الخاتمة");
    expect(attempts[1]!.body).toBe("المحاولة الثانية");
    expect(attempts[1]!.decision).toBeNull();
  });

  it("requires a note, because a return the Member cannot act on is not a return", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const first = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);
    if (first.status !== "submitted") throw new Error("submit failed");

    const result = await returnSubmission(db, first.submissionId, "e1", "   ", inSeason);
    expect(result.status).toBe("note-required");
    expect((await submissionRow(first.submissionId)).state).toBe("pending");
  });
});

describe("rejectSubmission", () => {
  it("rejects terminally with a note and mints nothing", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const first = await submitWork(db, task.id, "m1", { body: "x" }, inSeason);
    if (first.status !== "submitted") throw new Error("submit failed");

    const result = await rejectSubmission(db, first.submissionId, "e1", "خارج الموضوع", inSeason);
    expect(result.status).toBe("rejected");

    const sub = await submissionRow(first.submissionId);
    expect(sub.state).toBe("rejected");
    expect(sub.reviewNote).toBe("خارج الموضوع");

    const [attempt] = await attemptsOf(first.submissionId);
    expect(attempt!.decision).toBe("rejected");
    expect(await db.select().from(schema.pointAward)).toHaveLength(0);

    /** Terminal: a rejected Submission cannot be resubmitted. */
    const retry = await submitWork(db, task.id, "m1", { body: "again" }, inSeason);
    expect(retry.status).toBe("rejected");
  });
});

describe("reviewQueue", () => {
  it("lists pending Submissions oldest first, with the Task and Member named", async () => {
    await seedMember("m1", "أحمد");
    await seedMember("m2", "علي");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });

    const t1 = new Date("2026-03-10T09:00:00Z");
    const t2 = new Date("2026-03-11T09:00:00Z");
    await submitWork(db, task.id, "m1", { body: "أول" }, t1);
    const second = await submitWork(db, task.id, "m2", { body: "ثانٍ" }, t2);

    /** A returned Submission is not pending, so it must drop out of the queue. */
    await seedMember("m3", "حسن");
    const third = await submitWork(db, task.id, "m3", { body: "ثالث" }, t2);
    if (third.status === "submitted") {
      await returnSubmission(db, third.submissionId, "e1", "أعد", inSeason);
    }

    const queue = await reviewQueue(db);
    expect(queue).toHaveLength(2);
    expect(queue[0]!.memberName).toBe("أحمد");
    expect(queue[0]!.taskTitle).toBe("مهمة");
    expect(queue[1]!.memberName).toBe("علي");
    if (second.status === "submitted") {
      expect(queue[1]!.submissionId).toBe(second.submissionId);
    }
  });
});

describe("submissionForReview", () => {
  it("returns the Submission, the Task, the Member and every attempt in order (§24)", async () => {
    await seedMember("m1", "أحمد");
    await seedEditor("e1");
    const task = await seedTask({ mode: "review", points: 50 });
    const first = await submitWork(db, task.id, "m1", { body: "أولى" }, inSeason);
    if (first.status !== "submitted") throw new Error("submit failed");
    await returnSubmission(db, first.submissionId, "e1", "راجع", inSeason);
    await submitWork(db, task.id, "m1", { body: "ثانية" }, new Date("2026-03-16T12:00:00Z"));

    const detail = await submissionForReview(db, first.submissionId);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.memberName).toBe("أحمد");
    expect(detail.taskTitle).toBe("مهمة");
    expect(detail.taskPoints).toBe(50);
    expect(detail.state).toBe("pending");
    expect(detail.attempts).toHaveLength(2);
    expect(detail.attempts[0]!.body).toBe("أولى");
    expect(detail.attempts[0]!.decision).toBe("returned");
    expect(detail.attempts[0]!.reviewNote).toBe("راجع");
    expect(detail.attempts[1]!.body).toBe("ثانية");
  });

  it("returns null for a Submission that does not exist", async () => {
    expect(await submissionForReview(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("memberSubmissions", () => {
  it("reports the Member's own submission state per Task", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const a = await seedTask({ mode: "review", points: 50 });
    const b = await seedTask({ mode: "review", points: 30 });
    const subA = await submitWork(db, a.id, "m1", { body: "x" }, inSeason);
    if (subA.status === "submitted") {
      await acceptSubmission(db, subA.submissionId, "e1", 25, inSeason);
    }
    await saveDraft(db, b.id, "m1", { body: "مسوّدة" }, inSeason);

    const mine = await memberSubmissions(db, "m1", [a.id, b.id]);
    const byTask = new Map(mine.map((s) => [s.taskId, s]));
    expect(byTask.get(a.id)!.state).toBe("accepted");
    expect(byTask.get(b.id)!.state).toBe("draft");
  });
});

describe("completedTaskIds is scoped to accepted work", () => {
  it("does not count a pending or draft Submission as done", async () => {
    await seedMember("m1");
    await seedEditor("e1");
    const pending = await seedTask({ mode: "review", points: 50 });
    const draft = await seedTask({ mode: "review", points: 50 });
    const accepted = await seedTask({ mode: "review", points: 50 });

    await submitWork(db, pending.id, "m1", { body: "x" }, inSeason);
    await saveDraft(db, draft.id, "m1", { body: "y" }, inSeason);
    const s = await submitWork(db, accepted.id, "m1", { body: "z" }, inSeason);
    if (s.status === "submitted") await acceptSubmission(db, s.submissionId, "e1", 50, inSeason);

    const done = await completedTaskIds(db, "m1", [pending.id, draft.id, accepted.id]);
    /** Only the accepted Task is "done"; pending and draft are work in progress. */
    expect(done.has(accepted.id)).toBe(true);
    expect(done.has(pending.id)).toBe(false);
    expect(done.has(draft.id)).toBe(false);
    expect(done.size).toBe(1);
  });
});
