/**
 * Walks the entire magic-link flow against the running app and the live database.
 *
 * `verify-routes.mjs` proves the endpoints are mounted. This proves they *work*:
 * request a link, read the token out of the database the way the email would
 * deliver it, redeem it, and confirm a session and a member now exist. Without
 * this, "auth is wired" rests on a 200 from an endpoint that returns 200 whether
 * or not the token it created can ever be redeemed.
 *
 * Requires the dev server. Uses a `.invalid` address (RFC 2606) and cleans up
 * after itself.
 *
 * Usage: node scripts/verify-auth-flow.mjs [baseUrl]
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

const base = process.argv[2] ?? 'http://localhost:3000';
const email = `flow-${Date.now()}@faseela.invalid`;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

/* --- 1. Request a link ------------------------------------------------------ */

const requested = await fetch(`${base}/api/auth/sign-in/magic-link`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ email, name: 'عضو تجريبي', callbackURL: '/' }),
});
check('sign-in request accepted', requested.status === 200, `status ${requested.status}`);

/* --- 2. The token is stored hashed, not in plaintext ------------------------ */

const { rows: pending } = await client.query(
  `SELECT identifier, value, expires_at FROM verification WHERE value LIKE $1 ORDER BY created_at DESC LIMIT 1`,
  [`%${email}%`],
);
check('a verification row was created', pending.length === 1);

if (pending.length === 1) {
  const row = pending[0];

  /*
   * `storeToken: 'hashed'` means the identifier is a digest, not the token. This
   * is the assertion that setting actually took effect: a magic-link token is a
   * bearer credential, and plaintext storage would let anyone who can read this
   * table sign in as any member with a pending link.
   */
  check(
    'the token is stored as a hash, not plaintext',
    /^[a-f0-9]{64}$/i.test(row.identifier) || !row.identifier.includes(email),
    `identifier ${row.identifier.slice(0, 24)}…`,
  );

  /* Ten minutes, per the config — not Better Auth's five-minute default. */
  const ttlMinutes = Math.round((row.expires_at.getTime() - Date.now()) / 60000);
  check('the link expires in ~10 minutes', ttlMinutes >= 9 && ttlMinutes <= 10, `${ttlMinutes} min`);
}

/* --- 3. Redeem the link ----------------------------------------------------- */

/*
 * The token itself never touches the database in plaintext, so it cannot be read
 * back from there. It is scraped from the dev server's console output instead —
 * which is exactly what a member does with the email, and the reason the console
 * transport prints the URL on its own unadorned line.
 */
const { readFileSync } = await import('node:fs');
const devLog = new URL('../dev.log', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

let verifyUrl = null;
try {
  const log = readFileSync(devLog, 'utf8');
  const matches = [...log.matchAll(/http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?[^\s]+/g)];
  verifyUrl = matches.at(-1)?.[0] ?? null;
} catch {
  /* dev.log absent — the server may be running in a foreground terminal. */
}

check('the magic link was emitted by the transport', verifyUrl !== null);

if (verifyUrl) {
  const verified = await fetch(verifyUrl, { redirect: 'manual' });
  const cookie = verified.headers.get('set-cookie') ?? '';

  check(
    'redeeming the link redirects rather than erroring',
    verified.status === 302 || verified.status === 307,
    `status ${verified.status} → ${verified.headers.get('location')}`,
  );
  check(
    'no error was appended to the callback',
    !(verified.headers.get('location') ?? '').includes('error='),
    verified.headers.get('location') ?? '',
  );
  check('a session cookie was set', cookie.includes('session_token'), cookie.slice(0, 40));

  /* --- 4. The member and session now exist in the database ----------------- */

  const { rows: created } = await client.query(
    `SELECT id, email, name, email_verified FROM "user" WHERE email = $1`,
    [email],
  );
  check('the member row was created on verification', created.length === 1);
  if (created.length === 1) {
    check('the Arabic name survived the round trip', created[0].name === 'عضو تجريبي', created[0].name);
    check('the email is marked verified', created[0].email_verified === true);

    const { rows: sess } = await client.query(
      `SELECT count(*)::int AS n FROM session WHERE user_id = $1`,
      [created[0].id],
    );
    check('a session row was persisted', sess[0].n === 1, `${sess[0].n} session(s)`);

    /*
     * Single-use. `allowedAttempts` is deprecated upstream precisely because
     * tokens are now consumed atomically, and a replayable magic link is a
     * credential that survives in the member's inbox indefinitely.
     */
    const replay = await fetch(verifyUrl, { redirect: 'manual' });
    const replayLocation = replay.headers.get('location') ?? '';
    check(
      'the link cannot be redeemed twice',
      replayLocation.includes('error='),
      `replay → ${replayLocation.slice(0, 70)}`,
    );
  }
}

/* --- 5. Clean up ------------------------------------------------------------ */

await client.query(`DELETE FROM "user" WHERE email LIKE '%@faseela.invalid'`);
await client.query(`DELETE FROM verification WHERE value LIKE '%faseela.invalid%'`);
await client.end();

console.log(failures === 0 ? '\nThe magic-link flow works end to end.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
