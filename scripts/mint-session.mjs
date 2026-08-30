/**
 * Mints a signed session cookie for a user, for verifying gated pages headlessly.
 *
 *   node scripts/mint-session.mjs <email> [baseUrl]
 *
 * Inserts a short-lived session row (2 hours) exactly as Better Auth would, signs
 * the token the way its cookie plugin does (`token.base64(HMAC-SHA256(secret, token))`),
 * proves the cookie works by fetching a gated page, and prints the cookie VALUE on
 * stdout — use it as `SESSION=<value> pnpm verify:page /hisabi`.
 *
 * Dev only: it reads BETTER_AUTH_SECRET from .env.local, and the row it creates is
 * deleted by `--clean`, or expires on its own.
 */
import { createHmac, randomBytes } from "node:crypto";

import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  quiet: true,
});

const [email, base = "http://localhost:3000"] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"));
const clean = process.argv.includes("--clean");
if (!email) {
  console.error("usage: node scripts/mint-session.mjs <email> [baseUrl] [--clean]");
  process.exit(2);
}
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

if (clean) {
  const { rowCount } = await client.query(
    `delete from "session" where user_agent = 'mint-session.mjs'`,
  );
  console.error(`removed ${rowCount} minted session(s)`);
  await client.end();
  process.exit(0);
}

const { rows } = await client.query(`select id from "user" where email = $1`, [email]);
if (rows.length === 0) throw new Error(`no user with email ${email}`);
const userId = rows[0].id;

const token = randomBytes(32).toString("base64url");
const id = randomBytes(16).toString("base64url");
const now = new Date();
const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
await client.query(
  `insert into "session" (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent)
   values ($1, $2, $3, $4, $5, $5, '127.0.0.1', 'mint-session.mjs')`,
  [id, token, userId, expires, now],
);
await client.end();

const signature = createHmac("sha256", secret).update(token).digest("base64");
const cookie = `${token}.${signature}`;

// Prove it: a gated page must answer 200 with the cookie, and redirect without it.
const withCookie = await fetch(`${base}/hisabi`, {
  headers: { cookie: `better-auth.session_token=${encodeURIComponent(cookie)}` },
  redirect: "manual",
});
const without = await fetch(`${base}/hisabi`, { redirect: "manual" });
console.error(`/hisabi with cookie → ${withCookie.status}; without → ${without.status}`);
if (withCookie.status !== 200) {
  console.error("the minted cookie was not accepted — check the signing format or the schema");
  process.exit(1);
}
process.stdout.write(cookie + "\n");
