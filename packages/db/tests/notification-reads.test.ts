import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  markNotificationsSeen,
  notificationsFor,
  schema,
  unreadNotificationCount,
  type Database,
} from "@faseela/db";

/**
 * What a Member sees in their bell (§38), and the rule §3 sets around it: an update
 * is shown «من وقت إلى آخر» and not on every login, because the system knows they
 * already saw it. That is a watermark — everything published after the moment they
 * last looked is unread, and looking moves the moment forward.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const t1 = new Date("2026-03-01T00:00:00Z");
const t2 = new Date("2026-03-02T00:00:00Z");
const t3 = new Date("2026-03-03T00:00:00Z");
/** Before anything below is published, so a member seeded with it sees it all as new. */
const before = new Date("2026-02-01T00:00:00Z");

async function seedMember(id: string, seenAt: Date = before) {
  await db.insert(schema.user).values({
    id,
    name: `اسم-${id}`,
    email: `${id}@example.test`,
    lastNotificationsSeenAt: seenAt,
  });
}

/** A published notification: to one member when `userId` is given, else to everyone. */
async function publish(opts: {
  userId?: string;
  at: Date;
  title?: string;
  trackId?: string;
  type?: "announcement" | "submission_accepted";
}) {
  const [row] = await db
    .insert(schema.notification)
    .values({
      type: opts.type ?? "announcement",
      userId: opts.userId ?? null,
      title: opts.title ?? "عنوان",
      body: "نص",
      trackId: opts.trackId ?? null,
      state: "published",
      publishedAt: opts.at,
      createdAt: opts.at,
      updatedAt: opts.at,
    })
    .returning();
  return row!.id;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
});

describe("notificationsFor", () => {
  it("returns what is addressed to me and what is addressed to everyone, newest first", async () => {
    await seedMember("me");
    await seedMember("other");
    await publish({ at: t1, title: "للجميع" });
    await publish({ userId: "me", at: t2, title: "لي" });
    await publish({ userId: "other", at: t3, title: "لغيري" });

    const mine = await notificationsFor(db, "me");
    expect(mine.map((n) => n.title)).toEqual(["لي", "للجميع"]);
  });

  it("hides a notification that is still a draft", async () => {
    await seedMember("me");
    await db.insert(schema.notification).values({
      type: "announcement",
      title: "مسودة",
      body: "نص",
      state: "draft",
      createdAt: t1,
      updatedAt: t1,
    });
    expect(await notificationsFor(db, "me")).toEqual([]);
  });

  it("marks each one seen or unseen against the reader's watermark", async () => {
    await seedMember("me", t2);
    await publish({ at: t1, title: "قديم" });
    await publish({ at: t3, title: "جديد" });

    const mine = await notificationsFor(db, "me");
    expect(mine.find((n) => n.title === "جديد")!.seen).toBe(false);
    expect(mine.find((n) => n.title === "قديم")!.seen).toBe(true);
  });

  it("carries the Track it points at, so the reader can be taken there", async () => {
    await seedMember("me");
    const [track] = await db
      .insert(schema.track)
      .values({ slug: "reading", title: "حلقات القراءة", summary: "و" })
      .returning();
    await publish({ at: t1, trackId: track!.id });

    const [only] = await notificationsFor(db, "me");
    expect(only!.trackSlug).toBe("reading");
    expect(only!.trackTitle).toBe("حلقات القراءة");
  });
});

describe("unreadNotificationCount", () => {
  it("counts only what was published after the reader last looked", async () => {
    await seedMember("me", t2);
    await seedMember("other-member");
    await publish({ at: t1 }); // older than the watermark — already read
    await publish({ at: t3 }); // broadcast, new
    await publish({ userId: "me", at: t3 }); // mine, new
    await publish({ userId: "other-member", at: t3 }); // someone else's — never mine

    expect(await unreadNotificationCount(db, "me")).toBe(2);
  });

  it("gives a member who just joined nothing to catch up on", async () => {
    /** Everything below was published before they existed; the default watermark is
     * the moment the row was created, so none of it is theirs to read. */
    await publish({ at: t1 });
    await publish({ at: t2 });
    await db
      .insert(schema.user)
      .values({ id: "newcomer", name: "قادم جديد", email: "n@example.test" });

    expect(await unreadNotificationCount(db, "newcomer")).toBe(0);
  });
});

describe("markNotificationsSeen", () => {
  it("clears the badge", async () => {
    await seedMember("me", before);
    await publish({ at: t1 });
    await publish({ at: t2 });
    expect(await unreadNotificationCount(db, "me")).toBe(2);

    await markNotificationsSeen(db, "me", t3);
    expect(await unreadNotificationCount(db, "me")).toBe(0);
  });

  it("only ever moves forward, so a late request cannot un-read what was read", async () => {
    await seedMember("me", t3);
    await markNotificationsSeen(db, "me", t1);

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, "me"));
    expect(row!.lastNotificationsSeenAt).toEqual(t3);
  });
});
