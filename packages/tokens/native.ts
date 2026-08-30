/**
 * React-Native-safe entry point (`@faseela/tokens/native`).
 *
 * React Native's color parser accepts hex/rgb/hsl/named strings only — it cannot parse
 * the `oklch()` strings in `lib/colors.ts`, so the Expo app consumes this precomputed
 * hex mirror instead. The values are literals on purpose: no runtime culori dependency
 * ships to the app. `tests/native-parity.test.ts` recomputes every hex from the OKLCH
 * source (culori, CSS Color 4 gamut mapping — the seedling steps sit at the sRGB gamut
 * edge) and fails if the two drift, which is the only reason this duplication is
 * acceptable at all.
 *
 * Motion and type tokens are plain numbers, safe on every platform, so they are
 * re-exported from `lib/` untouched rather than mirrored.
 */

import type { ColorScale, LogoStop } from "./lib/colors.js";

export type { ColorScale, LogoStop, ScaleStep } from "./lib/colors.js";

/** Hex mirror of `seedling` (primary, from the logo's leaves and book). */
export const seedlingHex: ColorScale = {
  "50": "#f2f6f5",
  "100": "#bde7dc",
  "200": "#8ed5c4",
  "300": "#61c0ad",
  "400": "#3aaa96",
  "500": "#30917f",
  "600": "#2f7769",
  "700": "#315d54",
  "800": "#2c4640",
  "900": "#242f2d",
  "950": "#161c1b",
};

/** Hex mirror of `stem` (accent, from the stem, wordmark, and ornamental border). */
export const stemHex: ColorScale = {
  "50": "#f6f5f2",
  "100": "#e6dcc1",
  "200": "#d9c284",
  "300": "#c7a958",
  "400": "#b19134",
  "500": "#977b2b",
  "600": "#7c662a",
  "700": "#60522c",
  "800": "#473f29",
  "900": "#302c22",
  "950": "#1c1a15",
};

/** Hex mirror of `paper` (neutral with the near-imperceptible teal cast, ADR 0010). */
export const paperHex: ColorScale = {
  "50": "#f7fbfa",
  "100": "#dcdfde",
  "200": "#c1c5c4",
  "300": "#a8abaa",
  "400": "#8e9191",
  "500": "#767978",
  "600": "#5d6260",
  "700": "#474b4a",
  "800": "#313534",
  "900": "#1d2120",
  "950": "#0b0e0d",
};

/** Hex mirror of `logo` — the mark's gradient stops as designed (ADR 0029). */
export const logoHex: Record<LogoStop, string> = {
  "teal-hi": "#1ecfae",
  "teal-lo": "#0e9b82",
  "gold-hi": "#e3bd4e",
  "gold-lo": "#b18f2f",
  "teal-hi-night": "#35e2c2",
  "teal-lo-night": "#14b899",
  "gold-hi-night": "#ecd08a",
  "gold-lo-night": "#c7a958",
};

/** Hex mirror of `lightRoles`. `surfaceRaised` is the CSS keyword `white` there — `#ffffff` here. */
export const lightRolesNative = {
  surface: paperHex["50"],
  surfaceRaised: "#ffffff",
  border: paperHex["200"],
  ink: paperHex["950"],
  inkMuted: paperHex["600"],
  inkFaint: paperHex["400"],
  brand: seedlingHex["500"],
  brandFill: seedlingHex["400"],
  brandDeep: seedlingHex["600"],
  accent: stemHex["500"],
  accentFill: stemHex["400"],
  accentInk: stemHex["600"],
  tealHi: logoHex["teal-hi"],
  tealLo: logoHex["teal-lo"],
  goldHi: logoHex["gold-hi"],
  goldLo: logoHex["gold-lo"],
} as const;

/** Hex mirror of `darkRoles` — brand roles on steps 100-200 for APCA, same as the source. */
export const darkRolesNative = {
  surface: paperHex["950"],
  surfaceRaised: paperHex["900"],
  border: paperHex["800"],
  ink: paperHex["50"],
  inkMuted: paperHex["300"],
  inkFaint: paperHex["500"],
  brand: seedlingHex["200"],
  brandFill: seedlingHex["300"],
  brandDeep: seedlingHex["100"],
  accent: stemHex["200"],
  accentFill: stemHex["300"],
  accentInk: stemHex["200"],
  tealHi: logoHex["teal-hi-night"],
  tealLo: logoHex["teal-lo-night"],
  goldHi: logoHex["gold-hi-night"],
  goldLo: logoHex["gold-lo-night"],
} as const;

export { duration } from "./lib/motion.js";

export { fontSize, lineHeight, type TypeRole } from "./lib/type.js";
