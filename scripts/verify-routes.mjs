/**
 * Asserts that Better Auth's routes are actually reachable, and that Payload's
 * catch-all has not swallowed them.
 *
 * Two catch-all routes live under `/api` in this app: Better Auth at
 * `/api/auth/[...all]` and Payload at `/api/[...slug]`. Next.js resolves the
 * static segment `auth` ahead of the dynamic `[...slug]`, so auth wins — but that
 * is a framework resolution rule, not something either library guarantees. If a
 * Payload upgrade widened its route, or the route groups were reorganised, every
 * sign-in would start returning Payload's 404 JSON. The symptom would look like
 * an auth failure and send us debugging tokens.
 *
 * Requires the dev server to be running.
 *
 * Usage: node scripts/verify-routes.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const get = async (path) => {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
};

/*
 * Better Auth rejects state-changing requests without an `Origin` header
 * (`MISSING_OR_NULL_ORIGIN`) as CSRF defence, so a bare fetch cannot exercise
 * these endpoints. Sending the origin is what makes the probe represent a real
 * browser rather than a script.
 */
const post = async (path, body) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
};

/*
 * `/api/auth/ok` is Better Auth's own liveness endpoint. It answering at all is
 * the proof that the auth handler — not Payload's — owns this path.
 */
const ok = await get('/api/auth/ok');
check('GET /api/auth/ok is handled by Better Auth', ok.status === 200, `status ${ok.status}`);
check(
  'the response is Better Auth, not Payload',
  ok.body.includes('"ok"'),
  ok.body.slice(0, 80).replace(/\s+/g, ' '),
);

/*
 * The magic-link endpoint must accept a POST and return 200.
 *
 * It is checked with a `.invalid` address (RFC 2606, guaranteed never to resolve)
 * so the run creates a throwaway member rather than mailing a real person. A GET
 * here would be a useless check: Better Auth returns a bare 404 for the wrong
 * method, indistinguishable from the route not existing at all.
 */
const signIn = await post('/api/auth/sign-in/magic-link', {
  email: 'route-check@faseela.invalid',
  name: 'فحص المسار',
});
check(
  'POST /api/auth/sign-in/magic-link is served by Better Auth',
  signIn.status === 200,
  `status ${signIn.status} ${signIn.body.slice(0, 60)}`,
);

/*
 * An endpoint that requires a session must answer 401 with Better Auth's own
 * error body. Payload's catch-all would answer 404 with different JSON, so this
 * distinguishes "auth is mounted and rejecting me" from "auth is not mounted".
 */
const sessions = await get('/api/auth/list-sessions');
check(
  'protected auth endpoints answer 401, not Payload 404',
  sessions.status === 401 && sessions.body.includes('UNAUTHORIZED'),
  `status ${sessions.status}`,
);

/* Payload's REST API must still work — isolation cuts both ways. */
const payloadApi = await get('/api/pages');
check(
  'GET /api/pages still reaches Payload',
  payloadApi.status === 200 || payloadApi.status === 403,
  `status ${payloadApi.status}`,
);

/* And the admin panel, which shares no path with auth but shares the app. */
const admin = await get('/admin');
check('GET /admin still renders', admin.status === 200, `status ${admin.status}`);

const home = await get('/');
check('GET / still renders', home.status === 200, `status ${home.status}`);
check('the site is still RTL Arabic', /<html[^>]+dir="rtl"/i.test(home.body));

console.log(failures === 0 ? '\nRouting holds.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
