/**
 * One-off cleanup: drop the `payload` schema after Payload's removal from the
 * codebase (ADR 0023).
 *
 * Payload owned an isolated `payload` schema with 13 tables. With Payload gone,
 * those tables are orphaned — nothing reads or writes them. `CASCADE` takes the
 * schema's tables, enums and intra-schema foreign keys with it; `IF EXISTS` makes
 * a re-run (or a fresh database that never had Payload) a no-op rather than an
 * error. Runs against the unpooled host, like every other DDL in this repo.
 *
 * Usage: node scripts/drop-payload-schema.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

const before = await client.query(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'payload'`,
);
console.log(`payload schema tables before: ${before.rows[0].n}`);

await client.query('DROP SCHEMA IF EXISTS "payload" CASCADE');

const stillThere = await client.query(
  `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'payload'`,
);
console.log(`payload schema exists after drop: ${stillThere.rows.length > 0}`);

/* Sanity: our ledger is untouched. */
const ledger = await client.query("SELECT count(*)::int AS n FROM point_award");
console.log(`point_award rows (unchanged): ${ledger.rows[0].n}`);

await client.end();
console.log("Done. The payload schema is gone.");
