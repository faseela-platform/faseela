/**
 * Walks the entire member journey against the running app and the live database.
 *
 * `verify-auth-flow.mjs` proves a member can sign in. This proves the product
 * works: sign in, load a Track, complete an `attest` Task through the real Server
 * Action, watch Points appear in the ledger, and find yourself on the Leaderboard.
 *
 * Every assertion is made against HTTP responses and the database, never against
 * the code's own return values — the whole point is to catch the case where each
 * unit passes and the assembled journey does not.
 *
 * Uses a `.invalid` address (RFC 2606) and deletes its own rows afterwards.
 * `point_award.user_id` is RESTRICT (ADR 0016), so cleanup deletes the ledger rows
 * first; a plain user delete would raise 23001 and leave the fixture behind.
 *
 * Requires the dev server writing to ../dev.log.
 *
 * Usage: node scripts/verify-journey.mjs [baseUrl]
 */
import { readFileSync } from "node:fs";

import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  quiet: true,
});

const base = process.argv[2] ?? "http://localhost:3000";
const email = `journey-${Date.now()}@faseela.invalid`;
const NAME = "عضو الرحلة";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

/**
 * The Season the app itself will resolve. Read here so the ledger assertions are
 * scoped to the same Season the app writes into, rather than assuming there is
 * only ever one.
 */
const { rows: seasonRows } = await client.query(
  `SELECT id, slug FROM season WHERE starts_at <= now() AND ends_at > now()
    ORDER BY starts_at DESC LIMIT 1`,
);
check("a Season is open, so Points can be minted", seasonRows.length === 1);
const seasonId = seasonRows[0]?.id;

/**
 * An `attest` Task on a published Track. Chosen from the database rather than
 * hard-coded by slug, so re-seeding cannot silently make this script test nothing.
 */
const { rows: taskRows } = await client.query(
  `SELECT k.id, k.title, k.points, t.slug AS track_slug
     FROM task k JOIN track t ON t.id = k.track_id
    WHERE k.mode = 'attest' AND k.state = 'published' AND t.state = 'published'
    ORDER BY t.position, k.position LIMIT 1`,
);
check("a published attest Task exists to complete", taskRows.length === 1);

if (failures > 0) {
  await client.end();
  console.log("\nPreconditions unmet — run `pnpm seed` first.\n");
  process.exit(1);
}

const task = taskRows[0];
const trackUrl = `${base}/masarat/${task.track_slug}`;

/* --- 1. The Track page is readable signed out ------------------------------- */

const anonPage = await fetch(trackUrl);
const anonHtml = await anonPage.text();

check("the Track page loads for an anonymous visitor", anonPage.status === 200);
/**
 * The signed-out page must invite sign-in rather than present a button that would
 * be refused. This asserts the *absence* of the completion control, which is the
 * half of the conditional that a screenshot would not catch.
 */
check(
  "signed out, the page asks for sign-in instead of offering completion",
  anonHtml.includes("سجّل دخولك لتأكيد الإنجاز") && !anonHtml.includes("أكّدت إنجازها"),
);
check("the Task title is rendered from the database", anonHtml.includes(task.title), task.title);

/* --- 2. Sign in ------------------------------------------------------------- */

const requested = await fetch(`${base}/api/auth/sign-in/magic-link`, {
  method: "POST",
  /** Origin is mandatory: without it Better Auth returns 403 INVALID_ORIGIN. */
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ email, name: NAME, callbackURL: `/masarat/${task.track_slug}` }),
});
check("magic link requested", requested.status === 200, `status ${requested.status}`);

/**
 * Scraped from the console transport, which is what a Member does with the email.
 * The token is stored hashed, so it cannot be read back out of the database.
 */
const devLog = new URL("../dev.log", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let verifyUrl = null;
try {
  const log = readFileSync(devLog, "utf8");
  const matches = [
    ...log.matchAll(/http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?[^\s]+/g),
  ];
  verifyUrl = matches.at(-1)?.[0] ?? null;
} catch {
  /* dev.log absent */
}
check("the link reached the transport", verifyUrl !== null);

if (!verifyUrl) {
  await client.end();
  console.log("\nCannot continue without the magic link.\n");
  process.exit(1);
}

const verified = await fetch(verifyUrl, { redirect: "manual" });
const setCookie = verified.headers.get("set-cookie") ?? "";
check("redeeming the link redirects without error", [302, 307].includes(verified.status));
check(
  "the callback returns the Member to the Track they came from",
  (verified.headers.get("location") ?? "").includes(`/masarat/${task.track_slug}`),
  verified.headers.get("location") ?? "",
);

/**
 * Reduced to `name=value` pairs. `fetch` gives the full Set-Cookie with Path,
 * HttpOnly and SameSite attributes, and replaying those verbatim as a Cookie
 * header makes the server ignore the whole thing — which reads as an expired
 * session rather than a malformed request.
 */
const cookie = setCookie
  .split(/,(?=[^;]+=[^;]+)/)
  .map((c) => c.split(";")[0].trim())
  .filter(Boolean)
  .join("; ");
check("a session cookie was issued", cookie.includes("session_token"));

const { rows: members } = await client.query(`SELECT id, name FROM "user" WHERE email = $1`, [
  email,
]);
check("the Member row exists after verification", members.length === 1);
const userId = members[0]?.id;
check("the Arabic name survived", members[0]?.name === NAME, members[0]?.name);

/* --- 3. The signed-in Track page offers completion -------------------------- */

const authedPage = await fetch(trackUrl, { headers: { cookie } });
const authedHtml = await authedPage.text();

check("the Track page loads for the signed-in Member", authedPage.status === 200);
check(
  "signed in, the completion button is present",
  authedHtml.includes("أكّدت إنجازها") && !authedHtml.includes("سجّل دخولك لتأكيد الإنجاز"),
);
/**
 * The session must not leak into a shared cache. If the anonymous body and the
 * authenticated body were identical, `force-dynamic` had not taken effect and one
 * Member's progress would be served to the next visitor.
 */
check("the page is rendered per session, not served from one cache", anonHtml !== authedHtml);

/* --- 4. Complete the Task through the real Server Action -------------------- */

/**
 * Server Actions are invoked by posting to the page URL with a `Next-Action`
 * header carrying the action's id. The id is generated at build time and embedded
 * in the client bundle, so it cannot be hard-coded here.
 *
 * Calling `attestTask` directly instead would test the database helper a second
 * time and skip everything that has never run: the session read, the refusal
 * translation, and the cache revalidation. Those are exactly where a mutation UI
 * breaks.
 *
 * The chunk list comes from `src="..."` attributes. Matching bare `.js` substrings
 * in the HTML instead finds Turbopack's own inline references and misses the real
 * script tags — which is why the first version of this check found nothing while
 * the action was mounted and working the whole time.
 */
const chunks = [
  ...new Set([...authedHtml.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1])),
];
let actionId = null;

for (const chunk of chunks) {
  const js = await fetch(`${base}${chunk}`).then((r) => (r.ok ? r.text() : ""));
  /**
   * `createServerReference("<hex>"` is how the client refers to the action. The id
   * is 42 hex characters in this Next version, not the 40 assumed earlier — hence
   * `{20,}` rather than a fixed length, so a future change in id width does not
   * silently turn this assertion into a no-op.
   */
  const m = js.match(/createServerReference[^(]*\(\s*["']([0-9a-f]{20,})["']/);
  if (m) {
    actionId = m[1];
    break;
  }
}

check("the Server Action reference was found in the client bundle", actionId !== null);

let attestStatus = null;
if (actionId) {
  const posted = await fetch(trackUrl, {
    method: "POST",
    headers: {
      cookie,
      origin: base,
      "content-type": "text/plain;charset=UTF-8",
      "next-action": actionId,
    },
    body: JSON.stringify([task.id, task.track_slug]),
  });
  attestStatus = posted.status;
  check("the completion action was accepted", posted.status === 200, `status ${posted.status}`);
}

/* --- 5. The ledger, which is the only thing that counts -------------------- */

const { rows: awards } = await client.query(
  `SELECT points, season_id, task_id, submission_id FROM point_award WHERE user_id = $1`,
  [userId],
);
check("exactly one award was minted", awards.length === 1, `${awards.length} award(s)`);

if (awards.length === 1) {
  check(
    "the award carries the Task's value",
    awards[0].points === task.points,
    `${awards[0].points} vs task ${task.points}`,
  );
  check("the award belongs to the open Season", awards[0].season_id === seasonId);

  const { rows: subs } = await client.query(
    `SELECT state, body, reviewed_by, reviewed_at FROM submission WHERE id = $1`,
    [awards[0].submission_id],
  );
  check("the Submission is accepted", subs[0]?.state === "accepted", subs[0]?.state);
  /**
   * The heart of the attest model. Recording the Member as their own reviewer
   * would make the review queue's own counts overstate how much work Editors had
   * actually examined.
   */
  check(
    "the Submission has no reviewer, because nobody reviewed it",
    subs[0]?.reviewed_by === null && subs[0]?.reviewed_at === null,
  );
  check("nothing was submitted, so the body is null", subs[0]?.body === null);
}

/* --- 6. Idempotency, from the outside -------------------------------------- */

if (actionId) {
  /** A double tap, or a retried request after a lost response. */
  await fetch(trackUrl, {
    method: "POST",
    headers: {
      cookie,
      origin: base,
      "content-type": "text/plain;charset=UTF-8",
      "next-action": actionId,
    },
    body: JSON.stringify([task.id, task.track_slug]),
  });

  const { rows: after } = await client.query(
    `SELECT count(*)::int AS n FROM point_award WHERE user_id = $1`,
    [userId],
  );
  check(
    "a second completion mints nothing",
    after[0].n === 1,
    `${after[0].n} award(s) after retry`,
  );
}

/* --- 7. The Task now reads as done ---------------------------------------- */

const revisited = await fetch(trackUrl, { headers: { cookie } });
const revisitedHtml = await revisited.text();
check(
  "the completed Task shows as done rather than offering the button again",
  revisitedHtml.includes("مُنجزة"),
);

/* --- 8. The Leaderboard ---------------------------------------------------- */

const board = await fetch(`${base}/lawha`, { headers: { cookie } });
const boardHtml = await board.text();

check("the Leaderboard loads", board.status === 200);
check("the Member appears on it by name", boardHtml.includes(NAME));
/** `أنت` marks the reader's own row, which is the session-aware part. */
check("the Member's own row is marked", boardHtml.includes("أنت"));

const anonBoard = await fetch(`${base}/lawha`).then((r) => r.text());
check(
  "an anonymous visitor sees the ranking but not a personal standing",
  anonBoard.includes(NAME) && !anonBoard.includes("أنت"),
);

/* --- 9. Clean up ---------------------------------------------------------- */

/**
 * Order matters. `point_award.user_id` is RESTRICT, so the ledger rows must go
 * before the Member — the constraint that exists precisely to stop a Member
 * deletion from erasing history (ADR 0016).
 */
if (userId) {
  await client.query(`DELETE FROM point_award WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM submission WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM session WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM account WHERE user_id = $1`, [userId]);
}
await client.query(`DELETE FROM "user" WHERE email LIKE '%@faseela.invalid'`);
await client.query(`DELETE FROM verification WHERE value LIKE '%faseela.invalid%'`);

const { rows: leftover } = await client.query(
  `SELECT count(*)::int AS n FROM "user" WHERE email LIKE '%@faseela.invalid'`,
);
check("the test fixture was fully removed", leftover[0].n === 0);

await client.end();

console.log(
  failures === 0
    ? `\nThe member journey works end to end: sign in, complete, earn ${task.points} points, rank.\n`
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
