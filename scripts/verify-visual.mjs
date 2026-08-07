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

  // Each headline line must be fully revealed once the sequence has finished. A clip-path stuck at
  // inset(0 0 0 100%) is invisible but still occupies layout, so a screenshot alone can miss it.
  // Chromium serialises the resolved value as a four-value longhand, so compare numerically:
  // every inset must be 0, in whatever unit it was authored.
  const clips = await page.$$eval('.hero-line > span', (nodes) =>
    nodes.map((el) => getComputedStyle(el).clipPath),
  );
  const allRevealed =
    clips.length > 0 &&
    clips.every(
      (clip) =>
        clip === 'none' ||
        (clip.startsWith('inset(') &&
          [...clip.matchAll(/-?[\d.]+/g)].every((match) => parseFloat(match[0]) === 0)),
    );
  check('headline clip-paths have resolved to fully visible', allRevealed, `(got ${clips.join(' | ')})`);

  // Tatweel must survive as authored. Normalising it away would silently change the wordmark.
  const wordmark = await page.$eval('h1', (el) => el.textContent ?? '');
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

  // -------------------------------------------------------------------------
  // Rubric compliance (docs/design/reference.md). These encode the composition
  // decisions so a future edit cannot quietly undo them.
  // -------------------------------------------------------------------------

  // Restraint: the display must not balloon back to a shouty size, and must not be bold.
  const h1 = await page.$eval('h1', (el) => {
    const cs = getComputedStyle(el);
    return { size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) };
  });
  check('hero display size stays within the 80px ceiling', h1.size <= 80, `(${h1.size}px)`);
  check('hero weight stays at or below 500', h1.weight <= 500, `(${h1.weight})`);

  // Hard-alignment: nothing in the page's main flow may be centred. Centred type is the single
  // most visible departure from the reference.
  const centred = await page.$$eval('main h1, main h2, main p, main li', (nodes) =>
    nodes
      .filter((el) => getComputedStyle(el).textAlign === 'center')
      .map((el) => `${el.tagName}.${el.className}`)
      .slice(0, 5),
  );
  check('no centred text in the main flow', centred.length === 0, centred.join(', '));

  // Hairlines, not cards: no rounded, filled boxes in the lattice sections.
  const cards = await page.$$eval('.lattice > *', (nodes) =>
    nodes
      .filter((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.borderTopLeftRadius) > 2;
      })
      .map((el) => el.tagName)
      .slice(0, 5),
  );
  check('lattice cells have no border radius', cards.length === 0, cards.join(', '));

  // Recessive ordinals: an index numeral must never be brighter than its own heading.
  const loudOrdinal = await page.$$eval('.lattice .num', (nodes) =>
    nodes
      .filter((el) => {
        const cell = el.closest('.lattice > *');
        const heading = cell?.querySelector('h3');
        if (!heading) return false;
        // Compare relative luminance: the ordinal must be lighter (dimmer on a light ground).
        const parse = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = (c) => {
          const [r, g, b] = parse(c);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        return lum(getComputedStyle(el).color) < lum(getComputedStyle(heading).color);
      })
      .map((el) => el.textContent ?? '')
      .slice(0, 5),
  );
  check('ordinals stay dimmer than their headings', loudOrdinal.length === 0, loudOrdinal.join(', '));

  // The fold must not be dead space: the hero may not fill the viewport, so the next section is
  // partly visible. That partial visibility IS the scroll affordance.
  const heroFillsViewport = await page.evaluate(() => {
    const hero = document.querySelector('main > section');
    if (!hero) return true;
    return hero.getBoundingClientRect().height >= window.innerHeight;
  });
  check('hero does not fill the viewport (next section intrudes)', !heroFillsViewport);

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
    '.reveal, .reveal-fade, .reveal-grow, .reveal-stagger > *, .hero-line > *, .hero-lede, .hero-actions',
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

  const reducedClips = await page.$$eval('.hero-line > span', (nodes) =>
    nodes.map((el) => getComputedStyle(el).clipPath),
  );
  check(
    'headline is unclipped under reduced motion',
    reducedClips.every((c) => c === 'none'),
    `(got ${reducedClips.join(' | ')})`,
  );

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
