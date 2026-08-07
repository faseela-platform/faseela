/**
 * Proves that Payload and `@faseela/db` occupy separate Postgres schemas.
 *
 * This is not a formality. Payload's documentation states that by default it
 * "drops the current database schema", and `schemaName` — the option keeping it
 * away from ours — is marked experimental. So the arrangement is asserted rather
 * than assumed, and re-asserted after every Payload upgrade.
 *
 * Usage: node scripts/verify-isolation.mjs
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

/** The nine tables `@faseela/db` owns. Payload must never contain one of these. */
const OURS = [
  'user',
  'session',
  'account',
  'verification',
  'track',
  'task',
  'submission',
  'season',
  'point_award',
];

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const { rows } = await client.query(`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'payload') AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name
`);

const inPublic = rows.filter((r) => r.table_schema === 'public').map((r) => r.table_name);
const inPayload = rows.filter((r) => r.table_schema === 'payload').map((r) => r.table_name);

console.log(`\npublic  (${inPublic.length}): ${inPublic.join(', ')}`);
console.log(`payload (${inPayload.length}): ${inPayload.join(', ')}\n`);

check('the payload schema exists', inPayload.length > 0, `${inPayload.length} tables`);

for (const t of OURS) {
  check(`public.${t} still exists`, inPublic.includes(t));
}

/* The core assertion: nothing of ours has been recreated inside Payload's schema. */
const trespass = OURS.filter((t) => inPayload.includes(t));
check(
  'no Faseela table appears in the payload schema',
  trespass.length === 0,
  trespass.length ? `found ${trespass.join(', ')}` : 'clean',
);

/* And the reverse: Payload has not scattered its own tables into ours. */
const leaked = inPublic.filter((t) => t.startsWith('payload_') || t === 'editors' || t === 'pages' || t === 'announcements' || t === 'media');
check(
  'no Payload table appears in public',
  leaked.length === 0,
  leaked.length ? `found ${leaked.join(', ')}` : 'clean',
);

/**
 * Payload records its applied migrations in its own schema. If this table were in
 * `public`, Payload's migration bookkeeping and ours would share a namespace, and
 * a `drizzle-kit push` could plausibly decide it is not part of the desired schema.
 */
check('payload_migrations lives in the payload schema', inPayload.includes('payload_migrations'));

const ledger = await client.query('SELECT count(*)::int AS n FROM point_award');
check(
  'point ledger is readable and intact',
  typeof ledger.rows[0].n === 'number',
  `${ledger.rows[0].n} rows`,
);

await client.end();

console.log(failures === 0 ? '\nIsolation holds.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
