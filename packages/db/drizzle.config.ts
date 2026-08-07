import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated files committed to the repo, never `db:push`.
 * `push` diffs the live database against the schema and applies it silently,
 * which is fine alone on a laptop and unacceptable once Payload shares the
 * database and an Editor's content is in it — see ADR 0014.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  /**
   * Payload manages its own tables in the same database and drizzle-kit must
   * not offer to drop them. Ours are the ones listed in lib/schema.ts; Payload's
   * carry no prefix by default, so this filter is set once Payload's tables
   * exist and their names are known.
   */
  verbose: true,
  strict: true,
});
