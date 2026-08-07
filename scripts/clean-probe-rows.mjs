/**
 * Removes what `verify-routes.mjs` leaves behind.
 *
 * The route check POSTs a real sign-in, because that is the only way to prove the
 * endpoint belongs to Better Auth and not to Payload's catch-all. What it leaves
 * is a pending `verification` row, not a member: Better Auth creates the account
 * when the link is *verified*, not when it is requested. That ordering is worth
 * knowing — it means an unverified sign-in attempt cannot squat an email address,
 * and it means the probe's footprint expires on its own in ten minutes.
 *
 * The rows still get cleaned, because a table slowly filling with dead tokens
 * from CI runs makes the real contents harder to read.
 *
 * Everything matched uses the `.invalid` TLD (RFC 2606), which is reserved and
 * can never resolve, so no genuine member or link can ever match the pattern.
 *
 * Members, if any are ever found, are deleted rather than anonymised: ADR 0016's
 * anonymise-not-delete rule protects the Point ledger, and a member created
 * seconds ago by an HTTP probe holds no Points. The count is checked first, and
 * the RESTRICT on `point_award.user_id` would reject the delete regardless.
 *
 * Usage: node scripts/clean-probe-rows.mjs [--dry-run]
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

const dryRun = process.argv.includes('--dry-run');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

/* Pending magic links. `identifier` holds a JSON blob containing the email. */
const { rows: links } = await client.query(
  `SELECT identifier, expires_at FROM verification WHERE value LIKE '%faseela.invalid%' OR identifier LIKE '%faseela.invalid%'`,
);
console.log(`\nPending probe links: ${links.length}`);

const { rows: probes } = await client.query(
  `SELECT id, email, name, created_at FROM "user" WHERE email LIKE '%@faseela.invalid' ORDER BY created_at`,
);

if (probes.length === 0) {
  console.log('Probe members: 0 (expected — accounts are created on verify, not on request)');
} else {
  console.log(`\nProbe members (${probes.length}):`);
  for (const r of probes) {
    console.log(`  ${r.email}  ${r.name}  ${r.created_at.toISOString()}`);
  }

  /*
   * Checked, not assumed. A probe member with Points would mean the route check
   * had somehow been pointed at a real account, and deleting it would take
   * ledger history with it — so the count is read before anything is removed.
   */
  const { rows: awards } = await client.query(
    `SELECT count(*)::int AS n FROM point_award WHERE user_id = ANY($1::text[])`,
    [probes.map((r) => r.id)],
  );
  if (awards[0].n > 0) {
    console.error(
      `\nRefusing to delete: these members hold ${awards[0].n} point award(s). ` +
        'Use anonymiseMember instead — see ADR 0016.',
    );
    await client.end();
    process.exit(1);
  }
  console.log('  (no point awards held)');

  if (!dryRun) {
    /* Sessions and accounts cascade from user. */
    const del = await client.query(`DELETE FROM "user" WHERE email LIKE '%@faseela.invalid'`);
    console.log(`\nDeleted ${del.rowCount} probe member(s).`);
  }
}

if (dryRun) {
  console.log('\nDry run — nothing deleted.');
} else {
  const delLinks = await client.query(
    `DELETE FROM verification WHERE value LIKE '%faseela.invalid%' OR identifier LIKE '%faseela.invalid%'`,
  );
  console.log(`Deleted ${delLinks.rowCount} pending probe link(s).`);
}

await client.end();
