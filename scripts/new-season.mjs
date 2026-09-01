/**
 * Opens a Season — R2-C (owner decision 2026-09-01): «الموسم الثاني», 2026-09-01 →
 * 2026-12-31 inclusive (ends_at is EXCLUSIVE, per currentSeason in seasons.ts, so it
 * is stored as 2027-01-01T00:00:00Z). Idempotent: upserts by slug, like seed.mjs.
 *
 * Season creation has no admin UI yet (that arrives with Slice 15's system settings);
 * until then this script is the way a Season opens.
 *
 *   node scripts/new-season.mjs                      # الموسم الثاني (the defaults below)
 *   node scripts/new-season.mjs <slug> <title> <startISO> <endExclusiveISO>
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

const [slug, title, startsAt, endsAt] = [
  process.argv[2] ?? "2026-09",
  process.argv[3] ?? "الموسم الثاني",
  process.argv[4] ?? "2026-09-01T00:00:00Z",
  process.argv[5] ?? "2027-01-01T00:00:00Z",
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const res = await client.query(
    `insert into "season" (slug, title, starts_at, ends_at)
     values ($1, $2, $3, $4)
     on conflict (slug) do update
       set title = excluded.title,
           starts_at = excluded.starts_at,
           ends_at = excluded.ends_at
     returning id, slug, (xmax = 0) as inserted`,
    [slug, title, new Date(startsAt), new Date(endsAt)],
  );
  const row = res.rows[0];
  console.log(`season ${row.inserted ? "created" : "updated"}: ${slug} «${title}»`);
  console.log(`  ${startsAt} → ${endsAt} (exclusive)`);
} finally {
  await client.end();
}
