import { converter, formatHex, toGamut } from "culori";
import { describe, expect, it } from "vitest";

import {
  seedling,
  stem,
  paper,
  lightRoles,
  darkRoles,
  duration,
  fontSize,
  lineHeight,
  type ColorScale,
} from "../index.js";
import {
  seedlingHex,
  stemHex,
  paperHex,
  lightRolesNative,
  darkRolesNative,
  duration as durationNative,
  fontSize as fontSizeNative,
  lineHeight as lineHeightNative,
} from "../native.js";

/**
 * `native.ts` mirrors the OKLCH scales as precomputed hex because React Native's color
 * parser rejects `oklch()` strings. Same bargain as `tests/parity.test.ts`: the mirror is
 * only acceptable because this file recomputes every hex from the OKLCH source with an
 * independent library (culori, CSS Color 4 gamut mapping — the seedling steps sit at the
 * sRGB gamut edge, so out-of-gamut inputs are chroma-mapped, never clipped to NaN) and
 * fails if the two drift.
 */

const toRgb = converter("rgb");
const mapToSrgbGamut = toGamut("rgb", "oklch");

function oklchToHex(oklch: string): string {
  return formatHex(toRgb(mapToSrgbGamut(oklch)));
}

/** Parse `#rrggbb` (case-insensitive) into its three 0-255 channels. */
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
}

/** Case-insensitive, ±1 per RGB channel — rounding, not string equality. */
function expectHexClose(actual: string, oklch: string, label: string): void {
  const expected = oklchToHex(oklch);
  const a = channels(actual);
  const e = channels(expected);
  for (let i = 0; i < 3; i++) {
    expect(
      Math.abs(a[i]! - e[i]!),
      `${label}: ${actual} should match ${expected} (from ${oklch}) within ±1 per channel`,
    ).toBeLessThanOrEqual(1);
  }
}

describe("native hex scales match the OKLCH sources", () => {
  const pairs: Array<[string, ColorScale, ColorScale]> = [
    ["seedling", seedling, seedlingHex],
    ["stem", stem, stemHex],
    ["paper", paper, paperHex],
  ];

  for (const [name, oklchScale, hexScale] of pairs) {
    it(`${name}Hex matches ${name} at every step`, () => {
      expect(Object.keys(hexScale).sort()).toEqual(Object.keys(oklchScale).sort());
      for (const [step, oklch] of Object.entries(oklchScale)) {
        expectHexClose(hexScale[step as keyof ColorScale], oklch, `${name}-${step}`);
      }
    });
  }
});

describe("native role maps reference the same steps as the OKLCH role maps", () => {
  // oklch string -> the hex the native scales carry for that same step, so a role that
  // silently moved to a different step (or scale) cannot pass.
  const hexForOklch = new Map<string, string>();
  const scalePairs: Array<[ColorScale, ColorScale]> = [
    [seedling, seedlingHex],
    [stem, stemHex],
    [paper, paperHex],
  ];
  for (const [oklchScale, hexScale] of scalePairs) {
    for (const step of Object.keys(oklchScale) as Array<keyof ColorScale>) {
      hexForOklch.set(oklchScale[step], hexScale[step]);
    }
  }
  // lightRoles.surfaceRaised is the CSS keyword `white`; RN gets the literal hex.
  hexForOklch.set("white", "#ffffff");

  const rolePairs: Array<[string, Record<string, string>, Record<string, string>]> = [
    ["lightRoles", lightRoles, lightRolesNative],
    ["darkRoles", darkRoles, darkRolesNative],
  ];

  for (const [name, roles, rolesNative] of rolePairs) {
    it(`${name}Native mirrors ${name} role for role`, () => {
      expect(Object.keys(rolesNative).sort()).toEqual(Object.keys(roles).sort());
      for (const [role, value] of Object.entries(roles)) {
        expect(rolesNative[role], `${name}.${role}`).toBe(hexForOklch.get(value));
      }
    });
  }
});

describe("motion and type re-exports", () => {
  it("re-exports the identical objects, not copies", () => {
    expect(durationNative).toBe(duration);
    expect(fontSizeNative).toBe(fontSize);
    expect(lineHeightNative).toBe(lineHeight);
  });
});
