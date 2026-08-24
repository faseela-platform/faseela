/**
 * Confer or revoke a staff role on a Member, by email.
 *
 * Until the admin dashboard exists (Slice 4), this is how an Editor or Admin is
 * made: a deliberate act against an existing account, exactly as ADR 0023
 * describes. Roles are never self-serve.
 *
 * Usage: node scripts/set-role.mjs <email> <member|editor|admin>
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});

const [, , email, role] = process.argv;
if (!email || !["member", "editor", "admin"].includes(role)) {
  console.error("Usage: node scripts/set-role.mjs <email> <member|editor|admin>");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
await client.connect();

const res = await client.query(
  `UPDATE "user" SET role = $1, updated_at = now() WHERE email = $2
   RETURNING id, name, email, role`,
  [role, email],
);

if (res.rows.length === 0) {
  console.log(`No user with email ${email} — have they signed in yet?`);
} else {
  console.log("updated:", res.rows[0]);
}

await client.end();
