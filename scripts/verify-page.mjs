/**
 * The visual + accessibility gate for any page (AGENTS.md definition of done:
 * "Visual changes additionally need a Playwright screenshot in both directions and an
 * accessibility pass").
 *
 * `verify-visual.mjs` does this for the landing page and only the landing page — its
 * assertions are about the hero's clip-paths and the scroll rail. Every page added
 * since therefore shipped unverified. This script is the general one: give it paths,
 * it shoots and checks each of them.
 *
 * **Both directions.** The product is RTL. The point of also rendering LTR is not
 * that anyone will read it that way — it is that a physical `left`/`right` (instead of
 * a logical `start`/`end`) looks perfectly fine in the direction it was written in and
 * breaks in the other. Rendering both is how that class of bug becomes visible.
 *
 * Usage:
 *   node scripts/verify-page.mjs                     # the public pages, against localhost:3000
 *   node scripts/verify-page.mjs /tawasol /masarat   # only these
 *   BASE=https://faseela.vercel.app node scripts/verify-page.mjs
 */

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".scratch/shots/pages";

/** The pages a visitor can reach without a session. Gated pages need `SESSION` (below). */
const PUBLIC_PAGES = ["/", "/masarat", "/lawha", "/mustajaddat", "/tawasol", "/dukhul"];

const paths = process.argv.slice(2).length > 0 ? process.argv.slice(2) : PUBLIC_PAGES;
mkdirSync(OUT, { recursive: true });

const failures = [];
function check(page, name, ok, detail = "") {
  if (ok) {
    console.log(`    PASS  ${name}`);
  } else {
    console.log(`    FAIL  ${name} ${detail}`);
    failures.push(`${page} — ${name}${detail ? ` ${detail}` : ""}`);
  }
}

const slug = (p) => (p === "/" ? "home" : p.replace(/^\//, "").replace(/\//g, "-"));

/**
 * A session cookie, when one is supplied, so gated pages (`/idara/*`, `/hisabi`,
 * `/muraja3a`) can be verified too. Obtain it from a signed-in browser's
 * `better-auth.session_token` and pass it in:
 *   SESSION=<cookie-value> node scripts/verify-page.mjs /idara/tawasol
 */
const SESSION = process.env.SESSION ?? null;

const browser = await chromium.launch();
/**
 * Reduced motion, deliberately. Entrance reveals animate opacity, so a page caught
 * mid-flight yields half-faded colours — which makes both the screenshots and the
 * contrast results non-deterministic (a reveal at 40% opacity "fails" contrast on a
 * colour that is fine once it lands). Reduced motion resolves every reveal to its
 * final state immediately, and is itself the state ADR 0011 promises those visitors.
 */
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
if (SESSION) {
  const { hostname, protocol } = new URL(BASE);
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: SESSION,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

for (const path of paths) {
  const url = `${BASE}${path}`;
  const name = slug(path);
  console.log(`\n${path}`);

  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: "networkidle" });
  const status = response?.status() ?? 0;
  if (status >= 400) {
    check(path, `page responds (got ${status})`, false, SESSION ? "" : "— gated? set SESSION");
    await page.close();
    continue;
  }
  /** Let one-shot entrance animations settle so a shot is not caught mid-reveal. */
  await page.waitForTimeout(2200);

  // ---------------------------------------------------------------- direction 1: RTL
  await page.screenshot({ path: `${OUT}/${name}-rtl.png`, fullPage: true });

  check(path, 'html dir="rtl"', (await page.getAttribute("html", "dir")) === "rtl");
  check(path, 'html lang="ar"', (await page.getAttribute("html", "lang")) === "ar");

  /** letter-spacing on Arabic severs the cursive joins — the worst Arabic defect. */
  const spaced = await page.$$eval("*", (nodes) =>
    nodes
      .filter((el) => {
        if (!/[؀-ۿ]/.test(el.textContent ?? "")) return false;
        const ls = getComputedStyle(el).letterSpacing;
        return ls !== "normal" && ls !== "0px";
      })
      .map((el) => `${el.tagName}.${el.className}`)
      .slice(0, 5),
  );
  check(path, "no Arabic element carries letter-spacing", spaced.length === 0, spaced.join(", "));

  /** Arabic descenders and the vowel stack need ~1.4em minimum. */
  const tight = await page.$$eval("h1, h2, h3", (nodes) =>
    nodes
      .filter((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        return Number.isFinite(lh) && lh / parseFloat(cs.fontSize) < 1.4;
      })
      .map((el) => `${el.tagName}`)
      .slice(0, 5),
  );
  check(path, "headings clear the 1.4 Arabic leading floor", tight.length === 0, tight.join(", "));

  /** Numbers in RTL prose must be isolated or their digits and signs reorder. */
  const unisolated = await page.$$eval(
    ".num",
    (nodes) => nodes.filter((el) => !getComputedStyle(el).unicodeBidi.startsWith("isolate")).length,
  );
  check(path, "every .num is bidi-isolated", unisolated === 0, `(${unisolated})`);

  // ------------------------------------------------------------ accessibility pass
  await page.addScriptTag({ path: AXE_PATH });
  const axe = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, {
      resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      target: v.nodes[0]?.target?.join(" ") ?? "",
    }));
  });
  const serious = axe.filter((v) => v.impact === "critical" || v.impact === "serious");
  for (const v of axe) {
    console.log(`    a11y  ${v.impact.padEnd(8)} ${v.id} ×${v.nodes}  ${v.target}`);
  }
  check(path, "no critical/serious accessibility violations", serious.length === 0, `(${serious.length})`);

  // ---------------------------------------------------------------- direction 2: LTR
  /**
   * Forced to LTR to expose physical-property layout. A page built with logical
   * properties simply mirrors; one with a hard-coded `left` breaks here and only here.
   */
  await page.evaluate(() => {
    document.documentElement.setAttribute("dir", "ltr");
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-ltr.png`, fullPage: true });

  const ltrOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(path, "no horizontal overflow when mirrored to LTR", ltrOverflow <= 1, `(${ltrOverflow}px)`);
  await page.close();

  // ------------------------------------------------------------------------ mobile
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 393, height: 851 });
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1800);
  await mobile.screenshot({ path: `${OUT}/${name}-mobile.png`, fullPage: true });

  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(path, "no horizontal overflow on mobile", overflow <= 1, `(${overflow}px)`);

  /**
   * Touch targets. Form controls and buttons get the 44px floor the design rules ask
   * for; links get WCAG 2.5.8's 24px, because an inline text link inside a sentence is
   * explicitly exempt from the larger figure and holding a wordmark to 44px would only
   * teach us to ignore the check.
   *
   * Skipped: anything hidden from assistive tech or parked off-screen (a honeypot is
   * *supposed* to be untappable), and Next's dev-tools badge, which is not our UI.
   */
  const smallTargets = await mobile.$$eval("a, button, select, input, textarea", (nodes) =>
    nodes
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (r.left < -500 || r.top < -500) return false; // visually hidden off-canvas
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.closest("nextjs-portal, [data-nextjs-dev-tools-button], #next-logo")) return false;
        if (el.id.startsWith("next-")) return false;
        const floor = el.tagName === "A" ? 24 : 44;
        return r.height < floor;
      })
      .map((el) => `${el.tagName}#${el.id || "?"}:${Math.round(el.getBoundingClientRect().height)}px`)
      .slice(0, 6),
  );
  check(path, "touch targets meet their size floor", smallTargets.length === 0, smallTargets.join(", "));
  await mobile.close();
}

await browser.close();

console.log(`\nShots written to ${OUT}/`);
if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("\nAll visual and accessibility checks passed.");
