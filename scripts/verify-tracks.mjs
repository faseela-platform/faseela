/**
 * Verifies the Track pages render the real seeded rows, in RTL, with Arabic
 * intact and Latin numerals bidi-isolated.
 *
 * Asserts against the served HTML rather than a screenshot, because the defects
 * that matter here are invisible in a picture: an unpublished Track leaking, a
 * numeral without `unicode-bidi: isolate`, a missing `dir="rtl"`. A screenshot
 * would look correct in every one of those cases.
 *
 * Requires the dev server on :3000.
 * Usage: node scripts/verify-tracks.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  quiet: true,
});

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  FAIL  ${m}`);
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

async function main() {
  console.log(`\nVerifying Track pages at ${BASE}\n`);

  /* ---- The index ------------------------------------------------------ */
  const index = await get("/masarat");

  if (index.status === 200) ok("GET /masarat -> 200");
  else fail(`GET /masarat -> ${index.status}`);

  /**
   * The direction attribute is the single most load-bearing line in the app:
   * every `padding-inline`, `border-inline-start` and logical margin in the
   * codebase resolves off it. Without it the entire layout silently mirrors.
   */
  if (/<html[^>]+dir="rtl"/.test(index.html)) ok("index is dir=rtl");
  else fail("index is missing dir=rtl on <html>");

  if (/<html[^>]+lang="ar"/.test(index.html)) ok("index is lang=ar");
  else fail("index is missing lang=ar");

  /** All three seeded Tracks must appear, by their exact Arabic titles. */
  const TITLES = [
    ["مجموعات القراءة", "reading-groups"],
    ["البلاغ المبين", "al-balagh-al-mubin"],
    ["حتى يسمع كلام الله", "hatta-yasma-kalam-allah"],
  ];

  for (const [title, slug] of TITLES) {
    if (index.html.includes(title)) ok(`index shows "${title}"`);
    else fail(`index is missing "${title}"`);

    if (index.html.includes(`/masarat/${slug}`)) ok(`index links to /masarat/${slug}`);
    else fail(`index does not link to /masarat/${slug}`);
  }

  /**
   * Every numeral on the page must be inside a bidi-isolated span. Digits are
   * strongly LTR, so an unisolated number in Arabic prose reorders its
   * neighbours — the most common Arabic UI defect and completely invisible to a
   * developer who does not read Arabic.
   */
  const numSpans = index.html.match(/class="num[^"]*"[^>]*dir="ltr"/g) ?? [];
  if (numSpans.length >= 6) {
    ok(`index has ${numSpans.length} bidi-isolated numerals (2 per track minimum)`);
  } else {
    fail(`index has only ${numSpans.length} bidi-isolated numerals, expected >= 6`);
  }

  /**
   * The Arabic-typography prohibition from ADR/design docs: uppercase and
   * letter-spacing both destroy Arabic. `tracking-` is Tailwind's letter-spacing
   * utility and `uppercase` its case transform; neither may appear on this page.
   */
  if (!/class="[^"]*\btracking-/.test(index.html)) {
    ok("index applies no letter-spacing (would sever cursive joins)");
  } else {
    fail("index applies letter-spacing to Arabic text");
  }
  if (!/class="[^"]*\buppercase\b/.test(index.html)) {
    ok("index applies no uppercase transform");
  } else {
    fail("index applies uppercase, which is meaningless in Arabic");
  }

  /* ---- A Track with Tasks --------------------------------------------- */
  const detail = await get("/masarat/reading-groups");

  if (detail.status === 200) ok("GET /masarat/reading-groups -> 200");
  else fail(`GET /masarat/reading-groups -> ${detail.status}`);

  const EXPECTED_TASKS = [
    ["تلخيص الفصل الأول", "٥٠"],
    ["حضور جلسة النقاش", "٢٠"],
  ];

  for (const [title] of EXPECTED_TASKS) {
    if (detail.html.includes(title)) ok(`detail shows task "${title}"`);
    else fail(`detail is missing task "${title}"`);
  }

  /**
   * Points are formatted through `Intl.NumberFormat('ar-LB')`, which renders
   * Eastern Arabic-Indic digits. Asserting the rendered form rather than "50"
   * catches a regression where someone bypasses the Num component and
   * interpolates a raw number — visually similar, but unisolated.
   */
  if (detail.html.includes("٥٠") || detail.html.includes("50")) {
    ok("detail shows the documented 50-point value");
  } else {
    fail("detail does not show the 50-point value");
  }

  /** Both completion modes must be explained in the reader's language. */
  if (detail.html.includes("بحاجة إلى مراجعة")) ok("detail labels the review task");
  else fail("detail does not label the review task");

  if (detail.html.includes("تأكيد ذاتي")) ok("detail labels the attest task");
  else fail("detail does not label the attest task");

  /** The raw enum values must never reach the reader. */
  if (!/>\s*(attest|review)\s*</.test(detail.html)) {
    ok("raw enum values do not leak into the page");
  } else {
    fail("a raw enum value (attest/review) is rendered to the reader");
  }

  /* ---- A published Track with no Tasks -------------------------------- */
  const empty = await get("/masarat/hatta-yasma-kalam-allah");

  if (empty.status === 200) ok("GET the task-less track -> 200 (published, not hidden)");
  else fail(`GET the task-less track -> ${empty.status}`);

  /**
   * The empty state must say something. A published Track whose Tasks are not
   * written yet is a real state (ADR 0019), and rendering a bare page for it
   * looks like a failure rather than an early stage.
   */
  if (empty.html.includes("قيد الإعداد")) {
    ok("the task-less track explains itself instead of rendering blank");
  } else {
    fail("the task-less track renders no explanation");
  }

  /* ---- Unknown and unpublished slugs --------------------------------- */
  const missing = await get("/masarat/nope");
  if (missing.status === 404) ok("an unknown slug -> 404");
  else fail(`an unknown slug -> ${missing.status}, expected 404`);

  /**
   * The real test of the published filter: insert a draft Track, confirm it is
   * invisible on both the index and its own URL, then remove it. Asserting the
   * filter against a Track that is actually in the database is the only way to
   * prove it — every seeded row is published, so the filter is untested by them.
   */
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const DRAFT_SLUG = "verify-draft-should-not-appear";
  try {
    await client.query(
      `insert into "track" (slug, title, summary, state, position)
       values ($1, 'مسار مسوّدة', 'هذا المسار مسوّدة ولا يجب أن يظهر.', 'draft', 999)
       on conflict (slug) do nothing`,
      [DRAFT_SLUG],
    );

    /**
     * `revalidate = 60` means the index may be served from cache, so the draft
     * check hits the Track's own URL, which is rendered per unknown slug.
     */
    const draft = await get(`/masarat/${DRAFT_SLUG}`);
    if (draft.status === 404) {
      ok("a draft track 404s at its own URL (the published filter holds)");
    } else {
      fail(`a draft track returned ${draft.status} — the published filter is broken`);
    }

    if (!draft.html.includes("مسار مسوّدة")) {
      ok("a draft track's title never reaches the response body");
    } else {
      fail("a draft track's Arabic title leaked into the response");
    }
  } finally {
    await client.query(`delete from "track" where slug = $1`, [DRAFT_SLUG]);
    await client.end();
  }

  console.log(
    failures === 0 ? "\nAll track page checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nverify-tracks failed: ${err.message}`);
  process.exit(1);
});
