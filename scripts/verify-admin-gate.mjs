/**
 * Proves the production admin gate actually closes, and that it closes the right
 * doors.
 *
 * Run against a *production* server (`pnpm --filter @faseela/web build` then
 * `start`), because the gate is deliberately inert in development and a check run
 * against `next dev` would pass while proving nothing.
 *
 * Asserting the negative is the whole point of this file. A gate is the kind of code
 * that is written once, never exercised, and discovered to be broken by the person it
 * was meant to stop. In particular it asserts that Payload's REST API is closed too:
 * blocking `/admin` while leaving the API open protects the screen rather than the
 * data, and the create-first-user call goes through the API.
 *
 * Usage:
 *   node scripts/verify-admin-gate.mjs [baseURL]
 */

const base = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}: got ${actual}, expected ${expected}`);
}

async function status(path, init) {
  try {
    const res = await fetch(`${base}${path}`, { redirect: 'manual', ...init });
    return res.status;
  } catch (error) {
    console.log(`[FAIL] ${path} could not be reached: ${error.message}`);
    failures += 1;
    return 0;
  }
}

console.log(`Verifying the admin gate at ${base}\n`);

console.log('--- the panel must be closed ---');
check('GET /admin', await status('/admin'), 404);
check('GET /admin/login', await status('/admin/login'), 404);
check('GET /admin/collections/editors', await status('/admin/collections/editors'), 404);

console.log('\n--- and so must the API behind it ---');
/**
 * The one that matters. `POST /api/editors` is how a first Editor is created without
 * ever loading the admin UI, so a gate that permits this has protected nothing.
 */
check(
  'POST /api/editors (first-user creation by API)',
  await status('/api/editors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'gate-probe@example.invalid', password: 'probe-password-123' }),
  }),
  404,
);
check('GET /api/editors', await status('/api/editors'), 404);
check('GET /api/media', await status('/api/media'), 404);

console.log('\n--- while the member-facing site stays open ---');
check('GET /', await status('/'), 200);
check('GET /masarat', await status('/masarat'), 200);
check('GET /lawha', await status('/lawha'), 200);
check('GET /dukhul', await status('/dukhul'), 200);

console.log('\n--- and Better Auth is not caught by the matcher ---');
/**
 * 400 rather than 404 is the pass condition: it means the route ran and Better Auth
 * rejected the request on its own terms (no Origin header), which proves the
 * middleware did not intercept it. A 404 here would mean sign-in is broken in
 * production by the gate meant to protect the CMS.
 */
const authStatus = await status('/api/auth/sign-in/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'gate-probe@example.invalid' }),
});
const authReached = authStatus !== 404 && authStatus !== 0;
if (!authReached) failures += 1;
console.log(
  `${authReached ? '[PASS]' : '[FAIL]'} POST /api/auth/sign-in/magic-link reached the handler: ` +
    `got ${authStatus} (any status but 404 means the middleware let it through)`,
);

console.log(
  failures === 0
    ? '\nAll checks passed. The panel and its API are closed; the site and sign-in are open.'
    : `\n${failures} check(s) failed.`,
);

process.exit(failures === 0 ? 0 : 1);
