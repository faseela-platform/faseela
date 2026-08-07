/**
 * Screenshots the Track pages and measures the facts a picture cannot show.
 *
 * Two jobs. The screenshots let a human judge composition; the measurements
 * assert the things that look fine but are wrong — a numeral without bidi
 * isolation, content centred instead of hard-aligned to the margin, a card with
 * a border-radius where ADR 0012 requires a hairline.
 *
 * Requires the dev server on :3000.
 * Usage: node scripts/shoot-tracks.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = ".scratch/tracks";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const findings = [];

for (const [label, path, width] of [
  ["index-desktop", "/masarat", 1440],
  ["index-mobile", "/masarat", 390],
  ["detail-desktop", "/masarat/reading-groups", 1440],
  ["detail-mobile", "/masarat/reading-groups", 390],
  ["empty-desktop", "/masarat/hatta-yasma-kalam-allah", 1440],
]) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    /** Arabic locale so `Intl` in the page formats as it will for a real member. */
    locale: "ar-LB",
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90_000 });

  /**
   * Opacity is measured per element, each one scrolled into position first.
   *
   * This is not fussiness. `view()` timelines are scroll-position-linked, not
   * one-shot: scrolling away from an element *rewinds* its animation. An earlier
   * version of this script scrolled to the bottom, returned to the top for a tidy
   * screenshot, and only then measured — so it measured rewound animations and
   * reported perfectly good cells as stuck at opacity 0. It destroyed the state it
   * was measuring, and its false failures sent me to "fix" CSS that was correct.
   *
   * `fill-mode: both` holds the end state only while scroll position is at or past
   * the range end, which is why each element must be in view when read.
   */
  const fadedReport = await page.evaluate(async () => {
    const revealed = [
      ...document.querySelectorAll(".reveal, .reveal-fade, .reveal-grow, .reveal-stagger > *"),
    ];
    const faded = [];

    for (const el of revealed) {
      /**
       * `block: "center"` rather than "start": it puts the element well past the
       * point where any sane reveal range should have completed, which is exactly
       * the condition a reader experiences when reading it.
       */
      el.scrollIntoView({ block: "center", behavior: "instant" });
      await new Promise((r) => setTimeout(r, 220));

      const opacity = parseFloat(getComputedStyle(el).opacity);
      if (opacity < 0.9) {
        const text = (el.textContent ?? "").trim().slice(0, 24);
        faded.push(
          `${el.tagName}.${String(el.className).split(" ")[0]} opacity=${opacity.toFixed(3)} "${text}"`,
        );
      }
    }

    return { revealed: revealed.length, faded };
  });

  /**
   * The screenshot is taken last and from the top. It shows the page as a reader
   * first meets it, with above-the-fold reveals complete and below-the-fold ones
   * legitimately not yet started — the opacity assertion above, not the image, is
   * what proves the lower cells can finish.
   */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });

  const measured = await page.evaluate(() => {
    const out = {};

    out.dir = document.documentElement.getAttribute("dir");
    out.lang = document.documentElement.getAttribute("lang");

    /**
     * Every numeral must compute to `unicode-bidi: isolate`. Checking the
     * computed style rather than the class name catches the case where the class
     * is present but the CSS did not load.
     */
    const nums = [...document.querySelectorAll(".num")];
    out.numerals = nums.length;
    out.numeralsIsolated = nums.filter((n) =>
      getComputedStyle(n).unicodeBidi.includes("isolate"),
    ).length;
    out.numeralSamples = nums.slice(0, 4).map((n) => n.textContent.trim());

    /**
     * Arabic must carry no letter-spacing. `normal` is the only acceptable value:
     * any positive tracking severs the cursive joins between letters, which is
     * the single most severe Arabic typographic defect (W3C alreq §7.3).
     */
    const arabic = [...document.querySelectorAll("h1,h2,h3,p,dt,dd,a,span")].filter((el) =>
      /[\u0600-\u06FF]/.test(el.textContent ?? ""),
    );
    out.arabicElements = arabic.length;
    out.spacedArabic = arabic
      .filter((el) => {
        const ls = getComputedStyle(el).letterSpacing;
        return ls !== "normal" && parseFloat(ls) !== 0;
      })
      .map((el) => `${el.tagName}: ${getComputedStyle(el).letterSpacing}`);

    /** No uppercase transform: Arabic has no case, so it can only mangle Latin. */
    out.uppercased = arabic.filter(
      (el) => getComputedStyle(el).textTransform === "uppercase",
    ).length;

    /**
     * ADR 0012: cells are defined by hairline rules, never cards. A radius or a
     * shadow on a list item means the lattice has quietly become a card grid.
     */
    const cells = [...document.querySelectorAll(".lattice > *")];
    out.cells = cells.length;
    out.roundedCells = cells.filter((c) => parseFloat(getComputedStyle(c).borderRadius) > 0).length;
    out.shadowedCells = cells.filter((c) => getComputedStyle(c).boxShadow !== "none").length;

    /**
     * Hard-aligned to the margin, not centred. Under RTL the heading's right edge
     * should sit at the gutter, so the distance from the viewport's right edge
     * should equal the gutter padding — not half the leftover space.
     */
    const h1 = document.querySelector("h1");
    if (h1) {
      const r = h1.getBoundingClientRect();
      out.h1FromRightEdge = Math.round(window.innerWidth - r.right);
      out.h1FontSize = getComputedStyle(h1).fontSize;
      out.h1Family = getComputedStyle(h1).fontFamily.split(",")[0];
    }

    /** The lattice must draw real 1px rules, or it is not a lattice. */
    const firstCell = cells[0];
    if (firstCell) {
      const cs = getComputedStyle(firstCell);
      out.cellBorderBottom = cs.borderBottomWidth;
      out.cellMinHeight = cs.minHeight;
    }

    /**
     * Horizontal overflow is the classic RTL bug: a fixed element positioned with
     * a physical property that mirrors wrongly pushes the document sideways.
     */
    out.horizontalOverflow =
      document.documentElement.scrollWidth > document.documentElement.clientWidth;

    return out;
  });

  findings.push({ label, path, width, ...measured, ...fadedReport });
  await page.close();
}

await browser.close();
writeFileSync(`${OUT}/measured.json`, JSON.stringify(findings, null, 2));

/* ---- Report --------------------------------------------------------------- */
let problems = 0;
for (const f of findings) {
  console.log(`\n${f.label} (${f.width}px) ${f.path}`);
  console.log(`  dir=${f.dir} lang=${f.lang}`);
  console.log(`  numerals ${f.numeralsIsolated}/${f.numerals} bidi-isolated`);
  if (f.numeralsIsolated !== f.numerals) {
    console.error(`  PROBLEM: ${f.numerals - f.numeralsIsolated} numeral(s) not isolated`);
    problems++;
  }
  console.log(`  arabic elements ${f.arabicElements}, letter-spaced ${f.spacedArabic.length}`);
  if (f.spacedArabic.length > 0) {
    console.error(`  PROBLEM: letter-spacing on Arabic: ${f.spacedArabic.join(", ")}`);
    problems++;
  }
  if (f.uppercased > 0) {
    console.error(`  PROBLEM: ${f.uppercased} uppercased Arabic element(s)`);
    problems++;
  }
  console.log(
    `  cells ${f.cells}, rounded ${f.roundedCells}, shadowed ${f.shadowedCells}, rule ${f.cellBorderBottom}`,
  );
  if (f.roundedCells > 0 || f.shadowedCells > 0) {
    console.error(`  PROBLEM: lattice cells have card affordances (ADR 0012)`);
    problems++;
  }
  console.log(`  h1 ${f.h1FontSize} ${f.h1Family}, ${f.h1FromRightEdge}px from the right edge`);
  if (f.horizontalOverflow) {
    console.error(`  PROBLEM: the document overflows horizontally`);
    problems++;
  }
  console.log(`  revealed ${f.revealed}, still faded after scrolling ${f.faded.length}`);
  if (f.faded.length > 0) {
    console.error(`  PROBLEM: content stuck below full opacity — invisible to the reader:`);
    for (const d of f.faded) console.error(`           ${d}`);
    problems++;
  }
}

console.log(
  problems === 0
    ? `\nNo measured defects. Screenshots in ${OUT}/\n`
    : `\n${problems} measured defect(s). Screenshots in ${OUT}/\n`,
);
process.exit(problems === 0 ? 0 : 1);
