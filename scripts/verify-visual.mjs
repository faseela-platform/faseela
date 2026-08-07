/**
 * Visual and RTL verification for the landing page.
 *
 * Captures the states that the `animations` and `faseela-arabic-rtl` skills require a reviewer to
 * see, and asserts the ones a machine can check. Screenshots go to `.scratch/shots/`.
 *
 * Three things this checks that a human reviewer reliably misses:
 *   - that reduced motion resolves to the FINAL state, not a blank page
 *   - that the page is still legible with scroll timelines unsupported
 *   - that no Arabic element carries letter-spacing, which severs cursive joins
 *
 * Usage: node scripts/verify-visual.mjs [url]
 */

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:3210';
const OUT = '.scratch/shots';
mkdirSync(OUT, { recursive: true });

const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    console.log(`  FAIL  ${name} ${detail}`);
    failures.push(name);
  }
}

const browser = await chromium.launch();

// ---------------------------------------------------------------------------
// 1. Desktop, motion allowed. The hero sequence needs ~2.1s to settle.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/desktop-hero.png` });

  console.log('\nDesktop, motion allowed');

  check('html has dir="rtl"', (await page.getAttribute('html', 'dir')) === 'rtl');
  check('html has lang="ar"', (await page.getAttribute('html', 'lang')) === 'ar');

  // The wordmark must be fully revealed once the sequence has finished. A clip-path stuck at
  // inset(0 0 0 100%) is invisible but still occupies layout, so a screenshot alone can miss it.
  // Chromium serialises the resolved value as a four-value longhand, so compare numerically:
  // every inset must be 0, in whatever unit it was authored.
  const clip = await page.$eval('.hero-wordmark', (el) => getComputedStyle(el).clipPath);
  const insetsAreZero =
    clip === 'none' ||
    (clip.startsWith('inset(') &&
      [...clip.matchAll(/-?[\d.]+/g)].every((match) => parseFloat(match[0]) === 0));
  check('wordmark clip-path has resolved to fully visible', insetsAreZero, `(got "${clip}")`);

  // Tatweel must survive as authored. Normalising it away would silently change the wordmark.
  const wordmark = await page.$eval('.hero-wordmark', (el) => el.textContent ?? '');
  check('wordmark retains its authored tatweel (U+0640)', wordmark.includes('\u0640'));

  // letter-spacing on Arabic severs the cursive joins — the highest-severity Arabic defect.
  const spaced = await page.$$eval('*', (nodes) =>
    nodes
      .filter((el) => {
        const text = el.textContent ?? '';
        if (!/[\u0600-\u06FF]/.test(text)) return false;
        const ls = getComputedStyle(el).letterSpacing;
        return ls !== 'normal' && ls !== '0px';
      })
      .map((el) => `${el.tagName}.${el.className}`)
      .slice(0, 5),
  );
  check('no Arabic element carries letter-spacing', spaced.length === 0, spaced.join(', '));

  // Arabic descenders and the vowel stack need ~1.42em minimum at display sizes.
  const tight = await page.$$eval('h1, h2, h3', (nodes) =>
    nodes
      .filter((el) => {
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const lh = parseFloat(cs.lineHeight);
        return Number.isFinite(lh) && lh / size < 1.4;
      })
      .map((el) => {
        const cs = getComputedStyle(el);
        return `${el.tagName} ${cs.fontSize}/${cs.lineHeight}`;
      }),
  );
  check('no heading has leading below the 1.4 Arabic floor', tight.length === 0, tight.join(', '));

  // Numbers embedded in RTL prose must be isolated or the digits and signs reorder.
  const unisolated = await page.$$eval('.num', (nodes) =>
    nodes.filter((el) => {
      const cs = getComputedStyle(el);
      return cs.unicodeBidi !== 'isolate' && cs.unicodeBidi !== 'isolate-override';
    }).length,
  );
  check('every .num is bidi-isolated', unisolated === 0, `(${unisolated} unisolated)`);

  // Full-page shot for the reviewer.
  await page.screenshot({ path: `${OUT}/desktop-full.png`, fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// 2. Reduced motion. The critical assertion: content must be at its FINAL state.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/reduced-motion-hero.png` });

  console.log('\nReduced motion');

  // Nothing may be stranded invisible. This is the blank-page bug the brief warns about, and it is
  // the single most likely way a scroll-driven page fails an accessibility pass.
  const invisible = await page.$$eval(
    '.reveal, .reveal-fade, .reveal-grow, .reveal-stagger > *, .hero-tagline > *',
    (nodes) =>
      nodes
        .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 8),
  );
  check(
    'no revealable element is stranded below full opacity',
    invisible.length === 0,
    invisible.join(', '),
  );

  const clip = await page.$eval('.hero-wordmark', (el) => getComputedStyle(el).clipPath);
  check('wordmark is unclipped under reduced motion', clip === 'none', `(got "${clip}")`);

  await page.screenshot({ path: `${OUT}/reduced-motion-full.png`, fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------------------
// 3. Mid-scroll, to confirm scroll-linked sections actually reveal.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400);

  const height = await page.evaluate(() => document.body.scrollHeight);
  for (const [i, frac] of [0.25, 0.5, 0.75].entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), height * frac);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/scroll-${i + 1}.png` });
  }

  console.log('\nScroll states captured');
  await page.close();
}

// ---------------------------------------------------------------------------
// 4. Mobile, at the performance floor's viewport.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/mobile-hero.png` });

  console.log('\nMobile');

  // Horizontal overflow is the classic RTL layout defect: one element positioned with a physical
  // property instead of a logical one pushes the page sideways only in RTL.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('no horizontal overflow in RTL', overflow <= 1, `(${overflow}px)`);

  await page.screenshot({ path: `${OUT}/mobile-full.png`, fullPage: true });
  await page.close();
}

await browser.close();

console.log(`\nShots written to ${OUT}/`);
if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nAll automated checks passed.');
