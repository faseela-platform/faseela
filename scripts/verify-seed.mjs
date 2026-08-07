/**
 * Verifies the seeded content is present and intact.
 *
 * Written because the PowerShell console mangles Arabic beyond recognition —
 * `مجموعات القراءة` came back as `┘à╪¼┘à┘ê╪╣╪º╪¬` in the seed's own output. That
 * is a console encoding artefact, not corruption, but the two are
 * indistinguishable by eye, so the check compares against expected strings in
 * the script and reports only pass or fail. Byte-level comparison is the only
 * honest way to assert Arabic survived a round trip through a terminal that
 * cannot render it.
 *
 * Usage: node scripts/verify-seed.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  quiet: true,
});

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  FAIL  ${m}`);
};

/** Expected Arabic titles, compared by exact string equality. */
const EXPECTED_TRACKS = [
  { slug: "reading-groups", title: "مجموعات القراءة", position: 1, tasks: 2 },
  { slug: "al-balagh-al-mubin", title: "البلاغ المبين", position: 2, tasks: 1 },
  { slug: "hatta-yasma-kalam-allah", title: "حتى يسمع كلام الله", position: 3, tasks: 0 },
];

const EXPECTED_TASKS = [
  { track: "reading-groups", title: "تلخيص الفصل الأول", mode: "review", points: 50 },
  { track: "reading-groups", title: "حضور جلسة النقاش", mode: "attest", points: 20 },
  {
    track: "al-balagh-al-mubin",
    title: "تصميم صورة اقتباس ونشرها",
    mode: "review",
    points: 50,
  },
];

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  console.log("\nVerifying seeded content\n");

  /* ---- Tracks --------------------------------------------------------- */
  const tracks = await client.query(
    `select slug, title, summary, state, position, published_at from "track" order by position`,
  );

  if (tracks.rows.length === EXPECTED_TRACKS.length) {
    ok(`${tracks.rows.length} tracks`);
  } else {
    fail(`expected ${EXPECTED_TRACKS.length} tracks, found ${tracks.rows.length}`);
  }

  for (const expected of EXPECTED_TRACKS) {
    const row = tracks.rows.find((r) => r.slug === expected.slug);
    if (!row) {
      fail(`track ${expected.slug} missing`);
      continue;
    }
    /** Exact byte comparison: this is the Arabic integrity check. */
    if (row.title === expected.title) {
      ok(`track ${expected.slug} title intact (${expected.title.length} chars)`);
    } else {
      fail(`track ${expected.slug} title mismatch: stored ${JSON.stringify(row.title)}`);
    }
    if (row.state === "published" && row.published_at !== null) {
      ok(`track ${expected.slug} published with a date`);
    } else {
      fail(`track ${expected.slug} state=${row.state} published_at=${row.published_at}`);
    }
    if (row.position === expected.position) {
      ok(`track ${expected.slug} position ${row.position}`);
    } else {
      fail(`track ${expected.slug} position ${row.position}, expected ${expected.position}`);
    }
    /** Summary must be Arabic script, not a placeholder or mojibake. */
    if (/[\u0600-\u06FF]/.test(row.summary) && row.summary.length > 40) {
      ok(`track ${expected.slug} summary is Arabic prose`);
    } else {
      fail(`track ${expected.slug} summary suspicious: ${JSON.stringify(row.summary)}`);
    }
  }

  /* ---- Tasks ---------------------------------------------------------- */
  const tasks = await client.query(
    `select t.slug as track, k.title, k.instructions, k.mode, k.points, k.state,
            k.published_at
       from "task" k join "track" t on t.id = k.track_id
      order by t.position, k.position`,
  );

  if (tasks.rows.length === EXPECTED_TASKS.length) {
    ok(`${tasks.rows.length} tasks`);
  } else {
    fail(`expected ${EXPECTED_TASKS.length} tasks, found ${tasks.rows.length}`);
  }

  for (const expected of EXPECTED_TASKS) {
    const row = tasks.rows.find((r) => r.title === expected.title);
    if (!row) {
      fail(`task "${expected.title}" missing`);
      continue;
    }
    if (row.track === expected.track) {
      ok(`task "${expected.title}" on ${expected.track}`);
    } else {
      fail(`task "${expected.title}" on ${row.track}, expected ${expected.track}`);
    }
    if (row.mode === expected.mode && row.points === expected.points) {
      ok(`task "${expected.title}" ${row.mode} / ${row.points} points`);
    } else {
      fail(
        `task "${expected.title}" ${row.mode}/${row.points}, expected ${expected.mode}/${expected.points}`,
      );
    }
    if (/[\u0600-\u06FF]/.test(row.instructions) && row.instructions.length > 30) {
      ok(`task "${expected.title}" instructions are Arabic prose`);
    } else {
      fail(`task "${expected.title}" instructions suspicious`);
    }
  }

  /**
   * The 50-point anchor is the one value either source document states, so it is
   * asserted by itself: if a future edit drifts it, the seed has lost its only
   * documented number.
   */
  const anchor = tasks.rows.find((r) => r.title === "تلخيص الفصل الأول");
  if (anchor?.points === 50) {
    ok("the documented 50-point reading anchor is intact");
  } else {
    fail(`reading anchor is ${anchor?.points}, the documents say 50`);
  }

  /** The empty Track is deliberate, not a seeding failure. Assert it stays empty. */
  const emptyTrack = tasks.rows.filter((r) => r.track === "hatta-yasma-kalam-allah");
  if (emptyTrack.length === 0) {
    ok("hatta-yasma-kalam-allah has no tasks (documents specify none — ADR 0019)");
  } else {
    fail(`hatta-yasma-kalam-allah unexpectedly has ${emptyTrack.length} tasks`);
  }

  /* ---- Season --------------------------------------------------------- */
  const seasons = await client.query(
    `select slug, title, starts_at, ends_at from "season" order by starts_at`,
  );

  if (seasons.rows.length >= 1) {
    ok(`${seasons.rows.length} season(s)`);
  } else {
    fail("no season seeded");
  }

  for (const s of seasons.rows) {
    /**
     * The documents say a Season is a two-month themed block (الملف التعريفي
     * p.13). Asserted in months rather than days because two-month blocks vary
     * between 59 and 62 days.
     */
    const months =
      (s.ends_at.getUTCFullYear() - s.starts_at.getUTCFullYear()) * 12 +
      (s.ends_at.getUTCMonth() - s.starts_at.getUTCMonth());
    if (months === 2) {
      ok(`season ${s.slug} spans exactly 2 months (قوالب فصلية)`);
    } else {
      fail(`season ${s.slug} spans ${months} months, the documents say 2`);
    }
  }

  /**
   * The Season must contain now, or `currentSeason` returns null and
   * `awardPoints` refuses to mint — which would make the whole Track page
   * unable to award anything despite looking healthy.
   */
  const now = new Date();
  const active = seasons.rows.find((s) => s.starts_at <= now && s.ends_at > now);
  if (active) {
    ok(`a season is active now (${active.slug}) so awardPoints can mint`);
  } else {
    fail("no season contains the current instant — awardPoints will refuse to mint");
  }

  /* ---- Referential sanity --------------------------------------------- */
  const orphans = await client.query(
    `select count(*)::int n from "task" k
      left join "track" t on t.id = k.track_id where t.id is null`,
  );
  if (orphans.rows[0].n === 0) {
    ok("no orphaned tasks");
  } else {
    fail(`${orphans.rows[0].n} tasks reference a missing track`);
  }

  await client.end();

  console.log(
    failures === 0 ? "\nAll seed checks passed.\n" : `\n${failures} seed check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nverify-seed failed: ${err.message}`);
  process.exit(1);
});
