/**
 * Re-seeds the tier ladder to the spec's §7 values — R2-C (owner decisions
 * 2026-09-01): a registered member is at least «عام» (the shipped seed made anyone
 * under 100 points read as «زائر», which §7 defines as account-less), and the old
 * متقدم-500 row becomes the named mid tier «مثابر» in §7's adjustable 400–999 band.
 *
 *   عام 0 · خاص 100 · متقدم 200 · مثابر 500 · فسيلي 1000
 *
 * Keys are re-mapped too (nothing gates on a key yet — Slice 16 will — so the keys
 * must mean what they say before that lands). Two passes inside one transaction
 * because `key` is unique and the mapping shifts every row.
 *
 * Tier stays derived-on-read (ADR 0024): this re-tiers every member on their next
 * read, no migration needed. Thresholds remain admin-editable at /idara/rutab (§46).
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

/** position → the ladder as the spec wants it. */
const LADDER = [
  { position: 0, key: "general", name: "عام", minPoints: 0 },
  { position: 1, key: "special", name: "خاص", minPoints: 100 },
  { position: 2, key: "advanced", name: "متقدم", minPoints: 200 },
  { position: 3, key: "steadfast", name: "مثابر", minPoints: 500 },
  { position: 4, key: "faseeli", name: "فسيلي", minPoints: 1000 },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  await client.query(`update "member_tier" set key = key || '__old'`);
  for (const t of LADDER) {
    const res = await client.query(
      `update "member_tier" set key = $1, name = $2, min_points = $3 where position = $4
       returning key, name, min_points, position`,
      [t.key, t.name, t.minPoints, t.position],
    );
    if (res.rowCount !== 1) throw new Error(`no tier row at position ${t.position}`);
    const r = res.rows[0];
    console.log(`  position ${r.position}: ${r.key} «${r.name}» ≥ ${r.min_points}`);
  }
  const leftover = await client.query(`select key from "member_tier" where key like '%__old'`);
  if (leftover.rowCount > 0)
    throw new Error(`unmapped tier rows: ${leftover.rows.map((r) => r.key)}`);
  await client.query("commit");
  console.log("tier ladder re-seeded to spec §7.");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
