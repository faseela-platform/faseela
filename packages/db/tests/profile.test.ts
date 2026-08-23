import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import {
  isProfileComplete,
  memberProfile,
  schema,
  setMemberProfile,
  type Database,
} from "@faseela/db";

/**
 * Member identity — name + phone at account creation (spec §5). Magic-link
 * sign-in only captures email, so a fresh Member arrives with an empty name and
 * no phone; §5 requires both (phone the primary contact), collected before the
 * account is considered complete. These pin that contract.
 */

const migrationsDir = join(__dirname, "../migrations");
const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"));

let db: Database;

/** A Member as magic-link sign-in leaves them: email only, no name, no phone. */
async function seedFreshMember(id: string) {
  await db.insert(schema.user).values({
    id,
    name: "",
    email: `${id}@example.test`,
    emailVerified: true,
  });
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
});

describe("isProfileComplete", () => {
  it("is false for a fresh magic-link member (no name, no phone)", () => {
    expect(isProfileComplete({ name: "", phoneNumber: null })).toBe(false);
  });
  it("is false when the name is only whitespace", () => {
    expect(isProfileComplete({ name: "   ", phoneNumber: "+96170123456" })).toBe(false);
  });
  it("is false when the phone is missing", () => {
    expect(isProfileComplete({ name: "عبد الله الخشن", phoneNumber: null })).toBe(false);
  });
  it("is false when the phone is only whitespace", () => {
    expect(isProfileComplete({ name: "عبد الله الخشن", phoneNumber: "  " })).toBe(false);
  });
  it("is true when both name and phone are present", () => {
    expect(isProfileComplete({ name: "عبد الله الخشن", phoneNumber: "+96170123456" })).toBe(true);
  });
  it("is false for a null profile", () => {
    expect(isProfileComplete(null)).toBe(false);
  });
});

describe("memberProfile", () => {
  it("returns null for an unknown member", async () => {
    expect(await memberProfile(db, "nobody")).toBeNull();
  });
  it("reads the name and phone of a member", async () => {
    await seedFreshMember("m1");
    await setMemberProfile(db, "m1", { name: "عبد الله", phoneNumber: "+96170123456" });
    expect(await memberProfile(db, "m1")).toEqual({
      name: "عبد الله",
      phoneNumber: "+96170123456",
    });
  });
});

describe("setMemberProfile", () => {
  it("sets name and phone on a fresh member, completing the profile", async () => {
    await seedFreshMember("m1");
    expect(isProfileComplete(await memberProfile(db, "m1"))).toBe(false);

    const result = await setMemberProfile(db, "m1", {
      name: "عبد الله الخشن",
      phoneNumber: "+961 70 123 456",
    });
    expect(result.status).toBe("updated");
    expect(isProfileComplete(await memberProfile(db, "m1"))).toBe(true);
  });

  it("trims surrounding whitespace before storing", async () => {
    await seedFreshMember("m1");
    await setMemberProfile(db, "m1", { name: "  عبد الله  ", phoneNumber: "  +96170123456  " });
    expect(await memberProfile(db, "m1")).toEqual({
      name: "عبد الله",
      phoneNumber: "+96170123456",
    });
  });

  it("returns no-such-member for an unknown id", async () => {
    const result = await setMemberProfile(db, "ghost", {
      name: "x",
      phoneNumber: "+96170123456",
    });
    expect(result.status).toBe("no-such-member");
  });
});
