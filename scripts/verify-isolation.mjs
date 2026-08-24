/**
 * Proves the database is `@faseela/db`'s alone — the `payload` schema is gone.
 *
 * Payload once shared this database in its own `payload` schema, and this script
 * asserted the two stayed disjoint. Payload has been removed and its schema
 * dropped, so the assertion inverts: the `payload` schema must no longer exist,
 * and none of its former tables may have leaked into `public`. Kept as a guard so
 * a stray restore or an old migration replay is caught rather than assumed away.
 *
 * Usage: node scripts/verify-isolation.mjs
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

/** The tables `@faseela/db` owns. Every one must be present in `public`. */
const OURS = [
  "user",
  "session",
  "account",
  "verification",
  "track",
  "task",
  "submission",
  "season",
  "point_award",
];

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const { rows } = await client.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'payload') AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name
`);

const inPublic = rows.filter((r) => r.table_schema === "public").map((r) => r.table_name);
const inPayload = rows.filter((r) => r.table_schema === "payload").map((r) => r.table_name);

const { rows: schemata } = await client.query(
  `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'payload'`,
);

console.log(`\npublic (${inPublic.length}): ${inPublic.join(", ")}\n`);

check("the payload schema no longer exists", schemata.length === 0);
check("the payload schema holds no tables", inPayload.length === 0, `${inPayload.length} found`);

for (const t of OURS) {
  check(`public.${t} exists`, inPublic.includes(t));
}

/* No former Payload table has been recreated in our schema. */
const leaked = inPublic.filter(
  (t) =>
    t.startsWith("payload_") ||
    ["editors", "editors_sessions", "pages", "announcements", "media"].includes(t),
);
check(
  "no former Payload table appears in public",
  leaked.length === 0,
  leaked.length ? `found ${leaked.join(", ")}` : "clean",
);

const ledger = await client.query("SELECT count(*)::int AS n FROM point_award");
check(
  "point ledger is readable and intact",
  typeof ledger.rows[0].n === "number",
  `${ledger.rows[0].n} rows`,
);

await client.end();

console.log(
  failures === 0 ? "\nThe database is ours alone.\n" : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
