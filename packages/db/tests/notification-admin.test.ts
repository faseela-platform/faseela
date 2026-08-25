import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminNotifications,
  archiveNotification,
  createNotification,
  deleteNotification,
  notificationsFor,
  publishNotification,
  schema,
  unpublishNotification,
  updateNotification,
  type Database,
} from "@faseela/db";

/**
 * The broadcast half of §38 — «الإشعارات يجب أن تكون قابلة للإدارة من لوحة التحكم».
 * An admin writes an app update or an important announcement, and it reaches every
 * Member. Same publish lifecycle as a Track or a content piece, so a notice can be
 * drafted, checked and only then sent — an announcement is not recallable once read.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-03-15T12:00:00Z");

const row = (id: string) =>
  db.select().from(schema.notification).where(eq(schema.notification.id, id)).then((r) => r[0]!);

const draft = { type: "app_update" as const, title: "تحديث", body: "نص", createdBy: "admin" };

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await db.insert(schema.user).values({
    id: "admin",
    name: "الإدارة",
    email: "admin@example.test",
    role: "admin",
  });
  await db.insert(schema.user).values({
    id: "member",
    name: "عضو",
    email: "member@example.test",
    lastNotificationsSeenAt: new Date("2026-01-01T00:00:00Z"),
  });
});

describe("createNotification", () => {
  it("writes a draft addressed to everyone, carrying no publish date", async () => {
    const r = await createNotification(db, draft, at);
    expect(r.status).toBe("created");
    if (r.status !== "created") return;

    const saved = await row(r.id);
    expect(saved.state).toBe("draft");
    expect(saved.publishedAt).toBeNull();
    /** Null recipient is what makes it a broadcast. */
    expect(saved.userId).toBeNull();
    expect(saved.createdBy).toBe("admin");
  });

  it("refuses a blank title or body", async () => {
    expect((await createNotification(db, { ...draft, title: "  " }, at)).status).toBe("invalid");
    expect((await createNotification(db, { ...draft, body: "" }, at)).status).toBe("invalid");
  });

  it("stays out of members' bells until it is published", async () => {
    await createNotification(db, draft, at);
    expect(await notificationsFor(db, "member")).toEqual([]);
  });
});

describe("publish / unpublish / archive", () => {
  it("publishing stamps the date and delivers it to members", async () => {
    const r = await createNotification(db, draft, at);
    if (r.status !== "created") throw new Error();

    expect((await publishNotification(db, r.id, at)).status).toBe("published");
    expect((await row(r.id)).publishedAt).toEqual(at);
    expect((await notificationsFor(db, "member")).map((n) => n.title)).toEqual(["تحديث"]);
  });

  it("keeps the original publish date when re-published", async () => {
    const r = await createNotification(db, draft, at);
    if (r.status !== "created") throw new Error();
    await publishNotification(db, r.id, at);
    await publishNotification(db, r.id, new Date("2026-06-01T00:00:00Z"));
    expect((await row(r.id)).publishedAt).toEqual(at);
  });

  it("archiving and unpublishing take it back out of members' bells", async () => {
    const r = await createNotification(db, draft, at);
    if (r.status !== "created") throw new Error();
    await publishNotification(db, r.id, at);

    expect((await archiveNotification(db, r.id, at)).status).toBe("archived");
    expect((await row(r.id)).publishedAt).toBeNull();
    expect(await notificationsFor(db, "member")).toEqual([]);

    await publishNotification(db, r.id, at);
    expect((await unpublishNotification(db, r.id, at)).status).toBe("unpublished");
    expect(await notificationsFor(db, "member")).toEqual([]);
  });

  it("reports a missing notification rather than throwing", async () => {
    expect(
      (await publishNotification(db, "00000000-0000-0000-0000-000000000000", at)).status,
    ).toBe("not-found");
  });
});

describe("updateNotification and deleteNotification", () => {
  it("edits the wording", async () => {
    const r = await createNotification(db, draft, at);
    if (r.status !== "created") throw new Error();

    expect((await updateNotification(db, r.id, { title: "تحديث مهم" }, at)).status).toBe("updated");
    expect((await row(r.id)).title).toBe("تحديث مهم");
    expect((await updateNotification(db, r.id, { title: " " }, at)).status).toBe("invalid");
  });

  it("deletes one, and reports a missing one", async () => {
    const r = await createNotification(db, draft, at);
    if (r.status !== "created") throw new Error();
    expect((await deleteNotification(db, r.id)).status).toBe("deleted");
    expect((await deleteNotification(db, r.id)).status).toBe("not-found");
  });
});

describe("adminNotifications", () => {
  it("lists every notification whatever its state, newest first", async () => {
    const first = await createNotification(db, { ...draft, title: "الأولى" }, at);
    const second = await createNotification(
      db,
      { ...draft, title: "الثانية" },
      new Date(at.getTime() + 60_000),
    );
    if (first.status !== "created" || second.status !== "created") throw new Error();
    await publishNotification(db, second.id, at);

    const list = await adminNotifications(db);
    expect(list.map((n) => n.title)).toEqual(["الثانية", "الأولى"]);
    expect(list.map((n) => n.state)).toEqual(["published", "draft"]);
  });
});
