/**
 * Capture reference screenshots and measured typographic facts from a reference site.
 *
 * The point is not to copy the design. It is to replace impressions ("feels bigger") with numbers:
 * actual hero font sizes in px, weights, the ratio of display size to body size, section padding,
 * and the measure of body copy. Those numbers become the rubric the Faseela hero is judged against.
 *
 * Usage: node scripts/capture-reference.mjs <url> <label>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2];
const label = process.argv[3] ?? 'ref';
const OUT = '.scratch/reference';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
// Reference sites are animation-heavy; give the hero time to settle.
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/${label}-hero.png` });

/** Measure the largest text on screen and the surrounding rhythm. */
const measured = await page.evaluate(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      parseFloat(cs.opacity) > 0.05 &&
      (el.textContent ?? '').trim().length > 0
    );
  };

  const all = [...document.querySelectorAll('h1,h2,h3,h4,p,span,a,div,li')].filter(visible);

  const described = all.map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      lineHeight: parseFloat(cs.lineHeight),
      letterSpacing: cs.letterSpacing,
      family: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      text: (el.textContent ?? '').trim().slice(0, 70),
      top: Math.round(el.getBoundingClientRect().top),
    };
  });

  // Largest distinct text sizes, biggest first.
  const bySize = [...described].sort((a, b) => b.size - a.size);
  const seen = new Set();
  const largest = bySize
    .filter((d) => {
      const key = Math.round(d.size);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  // Body copy: the most common size among paragraph-like elements.
  const paragraphSizes = described
    .filter((d) => d.tag === 'P' && d.text.length > 60)
    .map((d) => Math.round(d.size));
  const frequency = {};
  for (const s of paragraphSizes) frequency[s] = (frequency[s] ?? 0) + 1;
  const bodySize = Number(
    Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 16,
  );

  // Section vertical padding, a strong signal of density.
  const sectionPadding = [...document.querySelectorAll('section, [class*="section"]')]
    .slice(0, 12)
    .map((el) => {
      const cs = getComputedStyle(el);
      return `${Math.round(parseFloat(cs.paddingTop))}/${Math.round(parseFloat(cs.paddingBottom))}`;
    });

  // Measure of the widest body paragraph, in characters.
  const measures = described
    .filter((d) => d.tag === 'P' && d.text.length > 80)
    .slice(0, 6)
    .map((d) => d.text.length);

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentHeight: document.body.scrollHeight,
    largest,
    bodySize,
    sectionPadding,
    measures,
    background: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.body).color,
  };
});

// Scroll captures, to see how sections are composed further down.
const height = await page.evaluate(() => document.body.scrollHeight);
for (const [i, frac] of [0.15, 0.35, 0.6].entries()) {
  await page.evaluate((y) => window.scrollTo(0, y), height * frac);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${label}-scroll-${i + 1}.png` });
}

writeFileSync(`${OUT}/${label}-measured.json`, JSON.stringify(measured, null, 2));

const ratio = (measured.largest[0]?.size ?? 0) / measured.bodySize;
console.log(`${label}: hero ${measured.largest[0]?.size}px / body ${measured.bodySize}px`);
console.log(`display-to-body ratio: ${ratio.toFixed(2)}x`);
console.log(`largest sizes: ${measured.largest.map((l) => `${Math.round(l.size)}(${l.weight})`).join(', ')}`);
console.log(`section padding: ${measured.sectionPadding.slice(0, 6).join(', ')}`);
console.log(`written to ${OUT}/${label}-*`);

await browser.close();
