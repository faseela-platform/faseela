import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  seedling,
  stem,
  paper,
  duration,
  travel,
  lineHeight,
  fontSize,
  type ColorScale,
} from '../index.js';

/**
 * `theme.css` is the source of truth for the web; `lib/*.ts` mirrors it for Motion and
 * React Native, which cannot read a CSS custom property. Two copies of the same numbers
 * drift silently, so these tests parse the CSS and assert the mirror matches.
 *
 * This is the reason the duplication is acceptable at all.
 */

const css = readFileSync(join(import.meta.dirname, '..', 'theme.css'), 'utf8');

function cssVar(name: string): string | undefined {
  const match = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'));
  return match?.[1]?.trim();
}

describe('colour parity', () => {
  const scales: Array<[string, ColorScale]> = [
    ['seedling', seedling],
    ['stem', stem],
    ['paper', paper],
  ];

  for (const [name, scale] of scales) {
    it(`${name} matches theme.css at every step`, () => {
      for (const [step, value] of Object.entries(scale)) {
        expect(cssVar(`--color-${name}-${step}`), `--color-${name}-${step}`).toBe(value);
      }
    });
  }
});

describe('motion parity', () => {
  it('durations match theme.css', () => {
    const pairs: Array<[string, number]> = [
      ['hover', duration.hover],
      ['press', duration.press],
      ['popover', duration.popover],
      ['modal', duration.modal],
      ['drawer', duration.drawer],
      ['page', duration.page],
    ];
    for (const [key, ms] of pairs) {
      expect(cssVar(`--duration-${key}`), `--duration-${key}`).toBe(`${ms}ms`);
    }
  });

  it('travel distances match theme.css', () => {
    expect(cssVar('--travel-sm')).toBe(`${travel.sm}px`);
    expect(cssVar('--travel-md')).toBe(`${travel.md}px`);
    expect(cssVar('--travel-lg')).toBe(`${travel.lg}px`);
  });
});

describe('type parity', () => {
  it('sizes match theme.css', () => {
    expect(cssVar('--text-body')).toBe(`${fontSize.body}rem`);
    expect(cssVar('--text-hero')).toBe(`${fontSize.hero}rem`);
    expect(cssVar('--text-display')).toBe(`${fontSize.display}rem`);
  });

  it('line heights match theme.css', () => {
    expect(cssVar('--text-body--line-height')).toBe(String(lineHeight.body));
    expect(cssVar('--text-hero--line-height')).toBe(String(lineHeight.hero));
  });
});

/**
 * These assert the constraints the numbers exist to satisfy, so that a future edit which
 * happens to keep CSS and TS in sync still cannot quietly reintroduce a known defect.
 */
describe('Arabic typography floors', () => {
  it('no display-tier leading drops below the measured Arabic floor of 1.42', () => {
    for (const role of ['display', 'hero', 'heroLg'] as const) {
      expect(lineHeight[role], `${role} leading`).toBeGreaterThanOrEqual(1.42);
    }
  });

  it('body leading exceeds the Latin convention of 1.5', () => {
    expect(lineHeight.body).toBeGreaterThan(1.5);
  });

  it("Tailwind's leading-tight is overridden to the Arabic floor", () => {
    // Left at Tailwind's 1.25 this clips descenders in five of eight candidate faces.
    expect(cssVar('--leading-tight')).toBe('1.42');
  });
});

describe('dark mode does not reuse light brand steps', () => {
  it('inverts brand roles to the 100-200 range', () => {
    // seedling-500 on paper-950 measures APCA Lc 35.8 — below even the large-text floor.
    const darkBlock = css.slice(css.indexOf("[data-theme='dark']"));
    const brand = darkBlock.match(/--brand:\s*var\(([^)]+)\)/)?.[1];
    expect(brand).toBe('--color-seedling-200');
  });
});
