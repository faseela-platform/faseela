import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import { schema, type Database } from "@faseela/db";

/**
 * Better Auth's rate limiter, when told `storage: "database"`, reads and writes
 * the `rateLimit` model — `key`, `count`, `lastRequest` — through the Drizzle
 * adapter. It does not create the table. This proves the migration does, that
 * it replays under PGlite like every other migration, and that the shape is the
 * one the limiter's `consume` relies on: a unique `key` (the create-or-increment
 * race is resolved by the unique violation) and a `lastRequest` wide enough for
 * `Date.now()` in milliseconds.
 */
const migrationsDir = join(__dirname, "../migrations");
const migration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n--> statement-breakpoint\n");

let db: Database;

beforeEach(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Database;
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) await db.execute(sql);
  }
});

describe("rate_limit table", () => {
  it("exists after the migrations replay, with the limiter's three columns", async () => {
    const { rows } = await db.execute(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'rate_limit' order by column_name`,
    );
    expect(rows).toEqual([
      { column_name: "count", data_type: "integer" },
      { column_name: "id", data_type: "text" },
      { column_name: "key", data_type: "text" },
      { column_name: "last_request", data_type: "bigint" },
    ]);
  });

  it("stores a millisecond timestamp and increments in place", async () => {
    const now = Date.now();
    await db
      .insert(schema.rateLimit)
      .values({ id: "r1", key: "1.2.3.4|/sign-in/magic-link", count: 1, lastRequest: now });
    const [row] = await db.select().from(schema.rateLimit);
    expect(row).toEqual({
      id: "r1",
      key: "1.2.3.4|/sign-in/magic-link",
      count: 1,
      lastRequest: now,
    });
  });

  it("refuses a second row for the same key — the create/increment race hinges on it", async () => {
    await db.insert(schema.rateLimit).values({ id: "r1", key: "k", count: 1, lastRequest: 1 });
    /** Drizzle wraps the driver error; the constraint name is on the cause. */
    const raised = await db
      .insert(schema.rateLimit)
      .values({ id: "r2", key: "k", count: 1, lastRequest: 2 })
      .then(
        () => null,
        (err: unknown) => ((err as { cause?: unknown }).cause ?? err) as { message?: string },
      );
    expect(raised?.message).toMatch(/rate_limit_key_unique/);
  });
});
