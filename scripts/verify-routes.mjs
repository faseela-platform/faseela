/**
 * Asserts that Better Auth's routes are reachable and answer as themselves, and
 * that the `/api/v1` mobile namespace is sealed.
 *
 * Better Auth is mounted at `/api/auth/[...all]`; the mobile API seals `/api/v1`
 * with its own catch-all. There is no longer a Payload `/api/[...slug]` to collide
 * with — Payload was removed — so this file's job is narrower than it once was:
 * prove auth is mounted and rejecting on its own terms, and prove an unknown `v1`
 * path returns the JSON error envelope the Expo app expects rather than an HTML 404.
 *
 * Requires the dev server to be running.
 *
 * Usage: node scripts/verify-routes.mjs [baseUrl]
 */
const base = process.argv[2] ?? "http://localhost:3000";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const get = async (path) => {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
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
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
};

/*
 * `/api/auth/ok` is Better Auth's own liveness endpoint. It answering at all is
 * the proof that the auth handler owns this path.
 */
const ok = await get("/api/auth/ok");
check("GET /api/auth/ok is handled by Better Auth", ok.status === 200, `status ${ok.status}`);
check(
  "the response is Better Auth",
  ok.body.includes('"ok"'),
  ok.body.slice(0, 80).replace(/\s+/g, " "),
);

/*
 * The magic-link endpoint must accept a POST and return 200.
 *
 * It is checked with a `.invalid` address (RFC 2606, guaranteed never to resolve)
 * so the run creates a throwaway member rather than mailing a real person. A GET
 * here would be a useless check: Better Auth returns a bare 404 for the wrong
 * method, indistinguishable from the route not existing at all.
 */
const signIn = await post("/api/auth/sign-in/magic-link", {
  email: "route-check@faseela.invalid",
  name: "فحص المسار",
});
check(
  "POST /api/auth/sign-in/magic-link is served by Better Auth",
  signIn.status === 200,
  `status ${signIn.status} ${signIn.body.slice(0, 60)}`,
);

/*
 * An endpoint that requires a session must answer 401 with Better Auth's own
 * error body — proof that auth is mounted and rejecting, not simply absent.
 */
const sessions = await get("/api/auth/list-sessions");
check(
  "protected auth endpoints answer 401",
  sessions.status === 401 && sessions.body.includes("UNAUTHORIZED"),
  `status ${sessions.status}`,
);

/*
 * The `/api/v1` namespace is sealed: an unknown path resolves to the mobile API's
 * own JSON 404 envelope, never a stray HTML 404. This is what lets the Expo app
 * parse every failure the same way.
 */
const v1junk = await get("/api/v1/no-such-endpoint");
check(
  "GET /api/v1/<unknown> returns the JSON 404 envelope",
  v1junk.status === 404 && v1junk.body.includes("not_found"),
  `status ${v1junk.status} ${v1junk.body.slice(0, 60)}`,
);

const home = await get("/");
check("GET / still renders", home.status === 200, `status ${home.status}`);
check("the site is still RTL Arabic", /<html[^>]+dir="rtl"/i.test(home.body));

console.log(failures === 0 ? "\nRouting holds.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
