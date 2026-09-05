import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  acceptSubmission,
  attestTask,
  createContentItem,
  followTrack,
  notificationsFor,
  publishContentItem,
  rejectSubmission,
  returnSubmission,
  schema,
  unfollowTrack,
  type Database,
} from "@faseela/db";

/**
 * The events §38 says are worth interrupting someone for: «قبول المهمة · رفض المهمة
 * لإعادة التعديل · رفض نهائي · اعتماد النقاط · فتح صلاحية جديدة».
 *
 * Every one is raised by the transaction that causes it, so a notification cannot
 * exist for an event that did not finish happening — and the Member is told once,
 * not once per page load. Tested through the seam that produces them (accept, return,
 * reject, attest) and the seam that reads them, never by poking the table directly.
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
  await db.insert(schema.user).values({
    id,
    name: `اسم-${id}`,
    email: `${id}@example.test`,
    role,
    /** Long before anything the tests publish, so emitted notices read as unseen. */
    lastNotificationsSeenAt: new Date("2026-01-01T00:00:00Z"),
  });
}

async function seedSeason() {
  await db.insert(schema.season).values({
    id: SEASON,
    slug: "s1",
    title: "الموسم",
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
  });
}

async function seedTrack(slug: string) {
  const [track] = await db
    .insert(schema.track)
    .values({ slug, title: `مسار-${slug}`, summary: "و", state: "published", publishedAt: at })
    .returning();
  return track!.id;
}

async function seedTask(mode: "attest" | "review", points: number, trackId?: string) {
  const id = trackId ?? (await seedTrack(`t-${points}-${mode}`));
  const [task] = await db
    .insert(schema.task)
    .values({
      trackId: id,
      title: "المهمة",
      instructions: "افعل",
      mode,
      points,
      state: "published",
      publishedAt: at,
    })
    .returning();
  return task!.id;
}

/** A pending submission with its open attempt, ready for a verdict. */
async function pendingSubmission(taskId: string, userId: string) {
  const [sub] = await db
    .insert(schema.submission)
    .values({ taskId, userId, body: "عملي", state: "pending", createdAt: at, updatedAt: at })
    .returning();
  await db
    .insert(schema.submissionAttempt)
    .values({ submissionId: sub!.id, attemptNo: 1, body: "عملي", submittedAt: at });
  return sub!.id;
}

const typesFor = async (userId: string) => (await notificationsFor(db, userId)).map((n) => n.type);

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await seedSeason();
  await seedUser("member");
  await seedUser("editor", "editor");
});

describe("a review decision tells the Member", () => {
  it("accepting says so, and says the points were credited", async () => {
    const taskId = await seedTask("review", 20);
    const subId = await pendingSubmission(taskId, "member");

    const r = await acceptSubmission(db, subId, "editor", 20, at);
    expect(r.status).toBe("accepted");

    const mine = await notificationsFor(db, "member");
    expect(mine.map((n) => n.type)).toContain("submission_accepted");
    /** The Member is told, not the Editor who pressed the button. */
    expect(await typesFor("editor")).toEqual([]);
    const accepted = mine.find((n) => n.type === "submission_accepted")!;
    expect(accepted.seen).toBe(false);
    expect(accepted.body).toContain("٢٠");
  });

  it("returning for revision says so", async () => {
    const taskId = await seedTask("review", 20);
    const subId = await pendingSubmission(taskId, "member");

    await returnSubmission(db, subId, "editor", "أعد صياغة الفقرة الأولى", at);
    expect(await typesFor("member")).toContain("submission_returned");
  });

  it("a final rejection says so", async () => {
    const taskId = await seedTask("review", 20);
    const subId = await pendingSubmission(taskId, "member");

    await rejectSubmission(db, subId, "editor", "خارج نطاق المسار", at);
    expect(await typesFor("member")).toContain("submission_rejected");
  });

  it("says nothing when the decision was refused", async () => {
    const taskId = await seedTask("review", 20);
    const subId = await pendingSubmission(taskId, "member");
    await acceptSubmission(db, subId, "editor", 20, at);
    const afterFirst = (await notificationsFor(db, "member")).length;

    /** No longer pending — the second verdict does nothing, and must announce nothing. */
    await acceptSubmission(db, subId, "editor", 20, at);
    expect(await notificationsFor(db, "member")).toHaveLength(afterFirst);
  });
});

describe("earning points tells the Member", () => {
  it("attesting a Task credits points and says so", async () => {
    const taskId = await seedTask("attest", 10);
    const r = await attestTask(db, taskId, "member", at);
    expect(r.status).toBe("completed");

    expect(await typesFor("member")).toContain("points_awarded");
  });

  it("says nothing when nothing was minted", async () => {
    /** A `review` Task cannot be attested — no award, so no announcement. */
    const taskId = await seedTask("review", 10);
    const r = await attestTask(db, taskId, "member", at);
    expect(r.status).toBe("not-attestable");
    expect(await typesFor("member")).toEqual([]);
  });

  it("announces a new capability when the points cross a tier threshold", async () => {
    /** The seeded ladder puts «عام» at 100 points: 90 stays put, the next 20 crosses. */
    const first = await seedTask("attest", 90);
    await attestTask(db, first, "member", at);
    expect(await typesFor("member")).not.toContain("tier_unlocked");

    const second = await seedTask("attest", 20);
    await attestTask(db, second, "member", at);

    const mine = await notificationsFor(db, "member");
    expect(mine.map((n) => n.type)).toContain("tier_unlocked");
    /** It names the tier they reached, or it tells them nothing they can act on. */
    expect(mine.find((n) => n.type === "tier_unlocked")!.body).toContain("عام");
  });
});

describe("publishing content on a Track tells the people following it", () => {
  /**
   * §38's first trigger: «تحديث مهم لمسار يتابعه المستخدم». Following is implicit —
   * a Member follows a Track by having worked in it — so the notice reaches the
   * people it means something to, and nobody else. That last part is «لا يجب تحويل
   * كل تحديث صغير إلى إشعار» applied to *audience* rather than frequency.
   */
  async function memberWhoWorkedIn(trackId: string, userId: string) {
    await seedUser(userId);
    const taskId = await seedTask("attest", 10, trackId);
    await attestTask(db, taskId, userId, at);
  }

  it("reaches members who have worked in that Track", async () => {
    const trackId = await seedTrack("reading");
    await memberWhoWorkedIn(trackId, "participant");

    const created = await createContentItem(
      db,
      { type: "product", title: "كتاب جديد", body: "أضفنا كتاباً", trackId, createdBy: "editor" },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    await publishContentItem(db, created.id, at);

    const theirs = await notificationsFor(db, "participant");
    const update = theirs.find((n) => n.type === "track_update");
    expect(update).toBeDefined();
    expect(update!.title).toContain("كتاب جديد");
    expect(update!.trackSlug).toBe("reading");
  });

  it("reaches an explicit follower who never worked in the Track (§10 is the audience now)", async () => {
    const trackId = await seedTrack("reading");
    await seedUser("watcher");
    await followTrack(db, "watcher", trackId);

    const created = await createContentItem(
      db,
      { type: "product", title: "كتاب جديد", body: "أضفنا كتاباً", trackId, createdBy: "editor" },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    await publishContentItem(db, created.id, at);

    expect((await notificationsFor(db, "watcher")).map((n) => n.type)).toContain("track_update");
  });

  it("respects an unfollow — a past worker who unfollowed hears nothing more", async () => {
    const trackId = await seedTrack("reading");
    await memberWhoWorkedIn(trackId, "left");
    await unfollowTrack(db, "left", trackId);

    const created = await createContentItem(
      db,
      { type: "product", title: "كتاب", body: "نص", trackId, createdBy: "editor" },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    await publishContentItem(db, created.id, at);

    expect((await notificationsFor(db, "left")).map((n) => n.type)).not.toContain("track_update");
  });

  it("does not reach members with no connection to that Track", async () => {
    const trackId = await seedTrack("reading");
    const otherTrack = await seedTrack("other");
    await memberWhoWorkedIn(otherTrack, "elsewhere");

    const created = await createContentItem(
      db,
      { type: "product", title: "كتاب", body: "نص", trackId, createdBy: "editor" },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    await publishContentItem(db, created.id, at);

    expect((await notificationsFor(db, "elsewhere")).map((n) => n.type)).not.toContain(
      "track_update",
    );
  });

  it("says nothing for track-less content, and nothing on re-publish", async () => {
    const trackId = await seedTrack("reading");
    await memberWhoWorkedIn(trackId, "participant");

    /** General Faseela content belongs to no Track, so it follows nobody. */
    const general = await createContentItem(
      db,
      { type: "news", title: "خبر", body: "نص", createdBy: "editor" },
      at,
    );
    if (general.status !== "created") throw new Error();
    await publishContentItem(db, general.id, at);
    expect((await notificationsFor(db, "participant")).map((n) => n.type)).not.toContain(
      "track_update",
    );

    /** Publishing the same piece twice is one update, not two. */
    const scoped = await createContentItem(
      db,
      { type: "product", title: "كتاب", body: "نص", trackId, createdBy: "editor" },
      at,
    );
    if (scoped.status !== "created") throw new Error();
    await publishContentItem(db, scoped.id, at);
    await publishContentItem(db, scoped.id, at);

    const updates = (await notificationsFor(db, "participant")).filter(
      (n) => n.type === "track_update",
    );
    expect(updates).toHaveLength(1);
  });
});
