import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  adminServiceRequests,
  createServiceRequest,
  schema,
  updateServiceRequestStatus,
  type Database,
  type ServiceRequestType,
} from "@faseela/db";

/**
 * Contacting Faseela (§37) — the intake side. Against PGlite because the rules that
 * matter are database-shaped: the has-contact CHECK, and a rate limit that counts
 * real rows in a real time window.
 *
 * This is the app's only unauthenticated write, so the guards (length caps, the
 * per-origin limit) are tested here at the `@faseela/db` seam rather than in the
 * form — a second caller (a mobile endpoint) must inherit them.
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
  db.select().from(schema.serviceRequest).where(eq(schema.serviceRequest.id, id)).then((r) => r[0]!);

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
});

const visitor = {
  requestType: "suggestion" as const,
  name: "سارة",
  email: "sara@example.test",
  body: "أقترح إضافة مسار للشعر.",
};

describe("createServiceRequest", () => {
  it("stores a visitor's suggestion as new, with no account attached", async () => {
    const r = await createServiceRequest(db, visitor, at);
    expect(r.status).toBe("created");
    if (r.status !== "created") return;

    const saved = await row(r.id);
    expect(saved.requestType).toBe("suggestion");
    expect(saved.name).toBe("سارة");
    expect(saved.body).toBe("أقترح إضافة مسار للشعر.");
    expect(saved.status).toBe("new");
    expect(saved.userId).toBeNull();
    expect(saved.createdAt).toEqual(at);
  });

  it("accepts each of §37's four kinds", async () => {
    for (const requestType of ["suggestion", "inquiry", "note", "app_issue"] as const) {
      const r = await createServiceRequest(db, { ...visitor, requestType }, at);
      expect(r.status).toBe("created");
    }
  });

  it("refuses a blank name or body", async () => {
    expect((await createServiceRequest(db, { ...visitor, name: "  " }, at)).status).toBe("invalid");
    expect((await createServiceRequest(db, { ...visitor, body: "" }, at)).status).toBe("invalid");
  });

  it("refuses a request with no way to answer it", async () => {
    const { email: _email, ...noContact } = visitor;
    expect((await createServiceRequest(db, noContact, at)).status).toBe("invalid");
  });

  it("accepts a signed-in member with no email or phone — their account is the contact", async () => {
    await db
      .insert(schema.user)
      .values({ id: "m1", name: "عبدالله", email: "m1@example.test" });
    const { email: _email, ...noContact } = visitor;

    const r = await createServiceRequest(db, { ...noContact, userId: "m1" }, at);
    expect(r.status).toBe("created");
    if (r.status !== "created") return;
    expect((await row(r.id)).userId).toBe("m1");
  });

  it("refuses a kind that is not one of §37's four, rather than throwing", async () => {
    const notAKind = "spam" as ServiceRequestType;
    expect((await createServiceRequest(db, { ...visitor, requestType: notAKind }, at)).status).toBe(
      "invalid",
    );
  });

  it("refuses fields that are not strings, rather than throwing", async () => {
    const notAString = 42 as unknown as string;
    expect((await createServiceRequest(db, { ...visitor, name: notAString }, at)).status).toBe(
      "invalid",
    );
    expect((await createServiceRequest(db, { ...visitor, body: notAString }, at)).status).toBe(
      "invalid",
    );
  });

  it("refuses over-long fields rather than storing them", async () => {
    expect((await createServiceRequest(db, { ...visitor, name: "ن".repeat(101) }, at)).status).toBe(
      "invalid",
    );
    expect((await createServiceRequest(db, { ...visitor, body: "ن".repeat(4001) }, at)).status).toBe(
      "invalid",
    );
    expect(
      (await createServiceRequest(db, { ...visitor, email: `${"a".repeat(200)}@x.test` }, at))
        .status,
    ).toBe("invalid");
  });
});

describe("createServiceRequest rate limiting", () => {
  it("refuses a sixth request from the same origin within the hour", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await createServiceRequest(db, { ...visitor, ipHash: "hash-a" }, at);
      expect(r.status).toBe("created");
    }
    expect((await createServiceRequest(db, { ...visitor, ipHash: "hash-a" }, at)).status).toBe(
      "rate-limited",
    );
  });

  it("counts each origin separately", async () => {
    for (let i = 0; i < 5; i++) {
      await createServiceRequest(db, { ...visitor, ipHash: "hash-a" }, at);
    }
    expect((await createServiceRequest(db, { ...visitor, ipHash: "hash-b" }, at)).status).toBe(
      "created",
    );
  });

  it("lets the same origin write again once the window has passed", async () => {
    for (let i = 0; i < 5; i++) {
      await createServiceRequest(db, { ...visitor, ipHash: "hash-a" }, at);
    }
    const laterThanTheWindow = new Date(at.getTime() + 61 * 60 * 1000);
    expect(
      (await createServiceRequest(db, { ...visitor, ipHash: "hash-a" }, laterThanTheWindow)).status,
    ).toBe("created");
  });

  it("counts requests with no origin hash together, so omitting one is not a way past the limit", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await createServiceRequest(db, visitor, at)).status).toBe("created");
    }
    expect((await createServiceRequest(db, visitor, at)).status).toBe("rate-limited");
  });

  it("holds the limit when requests from one origin arrive at the same moment", async () => {
    /** Ten at once against a limit of five: without the lock they all read a count of
     * zero and all get in. */
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createServiceRequest(db, { ...visitor, ipHash: "hash-burst" }, at),
      ),
    );
    expect(results.filter((r) => r.status === "created")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rate-limited")).toHaveLength(5);
  });
});

describe("the admin triage list", () => {
  /** Three requests, oldest to newest, so ordering and filtering have something to say. */
  async function seedThree() {
    const first = await createServiceRequest(db, { ...visitor, name: "الأولى" }, at);
    const second = await createServiceRequest(
      db,
      { ...visitor, name: "الثانية", requestType: "inquiry" },
      new Date(at.getTime() + 60_000),
    );
    const third = await createServiceRequest(
      db,
      { ...visitor, name: "الثالثة", requestType: "note" },
      new Date(at.getTime() + 120_000),
    );
    if (first.status !== "created" || second.status !== "created" || third.status !== "created") {
      throw new Error("seed");
    }
    return { first: first.id, second: second.id, third: third.id };
  }

  it("lists every request, newest first", async () => {
    const { third } = await seedThree();
    const list = await adminServiceRequests(db);
    expect(list.map((r) => r.name)).toEqual(["الثالثة", "الثانية", "الأولى"]);
    expect(list[0]!.id).toBe(third);
    expect(list[0]!.status).toBe("new");
  });

  it("narrows to one status when asked", async () => {
    const { second } = await seedThree();
    await updateServiceRequestStatus(db, second, { status: "handled" }, at);

    expect((await adminServiceRequests(db, { status: "handled" })).map((r) => r.name)).toEqual([
      "الثانية",
    ]);
    expect((await adminServiceRequests(db, { status: "new" })).map((r) => r.name)).toEqual([
      "الثالثة",
      "الأولى",
    ]);
  });

  it("carries the whole message, so triage does not need a second read", async () => {
    await seedThree();
    const [newest] = await adminServiceRequests(db);
    expect(newest!.body).toBe(visitor.body);
    expect(newest!.email).toBe(visitor.email);
  });
});

describe("updateServiceRequestStatus", () => {
  it("moves a request through triage and records who took it", async () => {
    await db.insert(schema.user).values({ id: "s1", name: "مشرف", email: "s1@example.test" });
    const created = await createServiceRequest(db, visitor, at);
    if (created.status !== "created") throw new Error();

    const later = new Date(at.getTime() + 3_600_000);
    expect(
      (
        await updateServiceRequestStatus(
          db,
          created.id,
          { status: "in_progress", handledBy: "s1" },
          later,
        )
      ).status,
    ).toBe("updated");

    const saved = await row(created.id);
    expect(saved.status).toBe("in_progress");
    expect(saved.handledBy).toBe("s1");
    expect(saved.updatedAt).toEqual(later);
  });

  it("reports a missing request rather than throwing", async () => {
    expect(
      (
        await updateServiceRequestStatus(
          db,
          "00000000-0000-0000-0000-000000000000",
          { status: "handled" },
          at,
        )
      ).status,
    ).toBe("not-found");
  });

  it("refuses a status that is not one of the four", async () => {
    const created = await createServiceRequest(db, visitor, at);
    if (created.status !== "created") throw new Error();
    const notAStatus = "deleted" as never;
    expect(
      (await updateServiceRequestStatus(db, created.id, { status: notAStatus }, at)).status,
    ).toBe("invalid");
  });
});
