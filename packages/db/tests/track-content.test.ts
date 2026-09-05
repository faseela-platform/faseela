import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  contentItemById,
  createContentItem,
  createTrack,
  publishContentItem,
  publishTrack,
  schema,
  taskContentChoices,
  trackContentItems,
  type Database,
} from "@faseela/db";

/**
 * محتوى المسار (§13/§14/§15/§19/§31) — the Track's content tab, the content page
 * with its linked Tasks (§15 path 1), and the Task's content choices (§15 path 2,
 * bounded by §19's filter). The seam is the three read functions; the write side
 * (content authoring, task content_scope) already exists.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;
const at = new Date("2026-09-02T12:00:00Z");

async function seedUser(id: string, role: "member" | "editor" | "admin" = "editor") {
  await db.insert(schema.user).values({ id, name: `اسم-${id}`, email: `${id}@example.test`, role });
}
async function publishedTrack(slug: string) {
  const r = await createTrack(db, { slug, title: `مسار-${slug}`, summary: "و" }, at);
  if (r.status !== "created") throw new Error("track");
  await publishTrack(db, r.id, at);
  return r.id;
}
async function publishedContent(
  trackId: string,
  title: string,
  opts: { classification?: string; type?: "product" | "cultural" } = {},
  when = at,
) {
  const created = await createContentItem(
    db,
    {
      type: opts.type ?? "product",
      title,
      body: "نص",
      trackId,
      classification: opts.classification ?? null,
      createdBy: "editor",
    },
    when,
  );
  if (created.status !== "created") throw new Error(created.status);
  await publishContentItem(db, created.id, when);
  return created.id;
}
async function publishedTask(trackId: string, title: string, contentScope: string | null) {
  const [t] = await db
    .insert(schema.task)
    .values({
      trackId,
      title,
      instructions: "x",
      mode: "review",
      points: 20,
      contentScope,
      state: "published",
      publishedAt: at,
    })
    .returning();
  return t!.id;
}

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
  await seedUser("editor");
});

describe("trackContentItems", () => {
  it("lists the Track's published content newest first — drafts and other Tracks' items never", async () => {
    const trackId = await publishedTrack("reading");
    const other = await publishedTrack("other");
    await publishedContent(trackId, "كتاب الشهر", {}, new Date("2026-09-01T10:00:00Z"));
    await publishedContent(trackId, "كتاب أحدث", {}, new Date("2026-09-02T10:00:00Z"));
    await publishedContent(other, "لغيره");
    const draft = await createContentItem(
      db,
      { type: "product", title: "مسودة", body: "نص", trackId, createdBy: "editor" },
      at,
    );
    if (draft.status !== "created") throw new Error();

    const items = await trackContentItems(db, trackId);
    expect(items.map((i) => i.title)).toEqual(["كتاب أحدث", "كتاب الشهر"]);
  });

  it("filters by classification when asked (§13's tabs within the content tab)", async () => {
    const trackId = await publishedTrack("reading");
    await publishedContent(trackId, "كتاب", { classification: "كتاب" });
    await publishedContent(trackId, "مقال", { classification: "مقال" });

    const books = await trackContentItems(db, trackId, { classification: "كتاب" });
    expect(books.map((i) => i.title)).toEqual(["كتاب"]);
  });
});

describe("contentItemById", () => {
  it("returns the published item with its Track and the Tasks linked to it (§15 path 1)", async () => {
    const trackId = await publishedTrack("reading");
    const bookId = await publishedContent(trackId, "كتاب الموسم", { classification: "كتاب" });
    await publishedTask(trackId, "لخص الكتاب", "track");
    await publishedTask(trackId, "استخرج اقتباسات", "كتاب");
    await publishedTask(trackId, "مهمة مقالات", "مقال");
    await publishedTask(trackId, "مهمة بلا محتوى", null);

    const page = await contentItemById(db, bookId);
    expect(page).not.toBeNull();
    expect(page!.trackSlug).toBe("reading");
    expect(page!.linkedTasks.map((t) => t.title).sort()).toEqual(["استخرج اقتباسات", "لخص الكتاب"]);
  });

  it("a draft or unknown id is null — indistinguishably, like trackBySlug", async () => {
    const trackId = await publishedTrack("reading");
    const draft = await createContentItem(
      db,
      { type: "product", title: "مسودة", body: "نص", trackId, createdBy: "editor" },
      at,
    );
    if (draft.status !== "created") throw new Error();

    expect(await contentItemById(db, draft.id)).toBeNull();
    expect(await contentItemById(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("the chosen content travels with the work (§15 path 2, §42)", () => {
  it("a scoped Task's submission records WHICH content it is about, readable back", async () => {
    const { createTask, memberSubmissions, submitWork } = await import("@faseela/db");
    await db.insert(schema.user).values({ id: "u1", name: "اسم", email: "u1@example.test" });
    const trackId = await publishedTrack("reading");
    const bookId = await publishedContent(trackId, "كتاب الموسم", { classification: "كتاب" });

    /** Authoring carries the §19 scope through the same admin seam as every field. */
    const created = await createTask(
      db,
      {
        trackId,
        title: "لخص الكتاب",
        instructions: "و",
        mode: "review",
        points: 40,
        contentScope: "كتاب",
      },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    const { publishTask } = await import("@faseela/db");
    await publishTask(db, created.id, at);

    const submitted = await submitWork(
      db,
      created.id,
      "u1",
      { body: "تلخيصي", contentId: bookId },
      at,
    );
    expect(submitted.status).toBe("submitted");

    const [mine] = await memberSubmissions(db, "u1", [created.id]);
    expect(mine!.contentId).toBe(bookId);
  });
});

describe("the chosen content is a claim the seam verifies (§19)", () => {
  async function scopedTask(trackId: string, scope: string) {
    const { createTask, publishTask } = await import("@faseela/db");
    const created = await createTask(
      db,
      { trackId, title: "و", instructions: "و", mode: "review", points: 20, contentScope: scope },
      at,
    );
    if (created.status !== "created") throw new Error(created.status);
    await publishTask(db, created.id, at);
    return created.id;
  }

  it("a draft, foreign-track, out-of-scope or malformed content id is refused, never thrown", async () => {
    const { submitWork } = await import("@faseela/db");
    await db.insert(schema.user).values({ id: "u1", name: "اسم", email: "u1@example.test" });
    const trackId = await publishedTrack("reading");
    const other = await publishedTrack("other");
    const taskId = await scopedTask(trackId, "كتاب");

    const draft = await createContentItem(
      db,
      {
        type: "product",
        title: "مسودة",
        body: "ن",
        trackId,
        classification: "كتاب",
        createdBy: "editor",
      },
      at,
    );
    if (draft.status !== "created") throw new Error();
    const foreign = await publishedContent(other, "لغيره", { classification: "كتاب" });
    const offScope = await publishedContent(trackId, "مقال", { classification: "مقال" });

    for (const bad of [draft.id, foreign, offScope, "not-a-uuid"]) {
      expect(await submitWork(db, taskId, "u1", { body: "ن", contentId: bad }, at)).toEqual({
        status: "invalid-content",
      });
    }
  });

  it("an unscoped Task refuses any content claim — it is about no content", async () => {
    const { submitWork } = await import("@faseela/db");
    await db.insert(schema.user).values({ id: "u1", name: "اسم", email: "u1@example.test" });
    const trackId = await publishedTrack("reading");
    const bookId = await publishedContent(trackId, "كتاب", { classification: "كتاب" });
    const plain = await publishedTask(trackId, "و", null);

    expect(await submitWork(db, plain, "u1", { body: "ن", contentId: bookId }, at)).toEqual({
      status: "invalid-content",
    });
  });

  it("contentItemById and taskContentChoices answer a malformed id with absence, not a throw", async () => {
    expect(await contentItemById(db, "not-a-uuid")).toBeNull();
    expect(await taskContentChoices(db, "not-a-uuid")).toEqual([]);
  });

  it("submitWork, saveDraft and memberSubmissions treat a malformed task id as absence too", async () => {
    /** The guard belongs IN the seam (code-review 2026-09-05): a route must not need
     * UUID_RE to keep Postgres from throwing on a uuid cast. */
    const { memberSubmissions, saveDraft, submitWork } = await import("@faseela/db");
    await db.insert(schema.user).values({ id: "u1", name: "اسم", email: "u1@example.test" });
    expect(await submitWork(db, "not-a-uuid", "u1", { body: "ن" }, at)).toEqual({
      status: "not-found",
    });
    expect(await saveDraft(db, "not-a-uuid", "u1", { body: "ن" }, at)).toEqual({
      status: "not-found",
    });
    expect(await memberSubmissions(db, "u1", ["not-a-uuid"])).toEqual([]);
  });
});

describe("drafts stay invisible through the choices read", () => {
  it("a DRAFT scoped Task offers no choices — its scope is nobody's business yet", async () => {
    const trackId = await publishedTrack("reading");
    await publishedContent(trackId, "كتاب", { classification: "كتاب" });
    const [draft] = await db
      .insert(schema.task)
      .values({
        trackId,
        title: "و",
        instructions: "x",
        mode: "review",
        points: 20,
        contentScope: "كتاب",
        state: "draft",
      })
      .returning();
    expect(await taskContentChoices(db, draft!.id)).toEqual([]);
  });
});

describe("listBodies (§2 برامج التأهيل وهيئات الإنتاج)", () => {
  it("returns the five seeded bodies in order, programs first", async () => {
    const { listBodies } = await import("@faseela/db");
    const bodies = await listBodies(db);
    expect(bodies.map((b) => b.name)).toEqual([
      "المعهد التدريبي",
      "كراسي المنبر الحر",
      "متجر فسيلة",
      "دار فسيلة",
      "مركز الإنتاج الفني",
    ]);
    expect(bodies[0]!.kind).toBe("program");
    expect(bodies[4]!.kind).toBe("production_body");
  });
});

describe("taskContentChoices", () => {
  it("scope «track» offers all the Track's published content; a classification narrows it (§19)", async () => {
    const trackId = await publishedTrack("reading");
    await publishedContent(trackId, "كتاب أ", { classification: "كتاب" });
    await publishedContent(trackId, "مقال ب", { classification: "مقال" });

    const wide = await taskContentChoices(db, await publishedTask(trackId, "و", "track"));
    expect(wide.map((c) => c.title).sort()).toEqual(["كتاب أ", "مقال ب"]);

    const narrow = await taskContentChoices(db, await publishedTask(trackId, "و", "كتاب"));
    expect(narrow.map((c) => c.title)).toEqual(["كتاب أ"]);
  });

  it("a Task without a scope offers nothing — it is about no content", async () => {
    const trackId = await publishedTrack("reading");
    await publishedContent(trackId, "كتاب");
    expect(await taskContentChoices(db, await publishedTask(trackId, "و", null))).toEqual([]);
    expect(await taskContentChoices(db, "00000000-0000-0000-0000-000000000000")).toEqual([]);
  });
});
