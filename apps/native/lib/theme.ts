/**
 * Brand tokens mapped to React Native styles — Slice 9 (ADR 0029, ADR 0012 revised).
 *
 * Colours come from the hex mirror (`@faseela/tokens/native`) because RN cannot parse
 * `oklch()`. Two palettes now — light and night — mirrored from the web's `:root` and
 * `[data-theme="dark"]` and parity-tested there; `useTheme()` (theme-context.tsx) hands
 * a screen the one in force. Nothing here reads the scheme itself, so this module stays
 * importable from plain node tests.
 *
 * Type sizes are rem-based in the token package; RN wants absolute points, so ×16 here.
 * Font weights are distinct families in RN — `Cairo_700Bold` is a family name, never
 * `fontWeight` alone.
 */

import {
  darkRolesNative,
  fontSize,
  lightRolesNative,
  lineHeight,
  logoHex,
  paperHex,
  seedlingHex,
  stemHex,
  type TypeRole,
} from "@faseela/tokens/native";

export type Scheme = "light" | "dark";

/** The role palette for a scheme, plus the few app-only tones derived from the ramps. */
export function palette(scheme: Scheme) {
  const roles = scheme === "dark" ? darkRolesNative : lightRolesNative;
  return {
    ...roles,
    /** Points chips: a gold tint with gold ink, quiet enough to repeat down a list. */
    chipBg: scheme === "dark" ? "#3a3220" : stemHex["100"],
    chipInk: scheme === "dark" ? stemHex["200"] : stemHex["700"],
    /** Teal tint for "your own" rows and live state. */
    tintBrand: scheme === "dark" ? "#12302b" : seedlingHex["50"],
    /** Hairline for separation on the raised surface. */
    hairline: scheme === "dark" ? paperHex["800"] : paperHex["100"],
    /** Card shadow colour; opacity is applied by `shadow()`. */
    shadowColor: scheme === "dark" ? "#000000" : paperHex["950"],
    /** The theme's own accent for a few decorative strokes (the sign-in mark's glow). */
    glow: scheme === "dark" ? logoHex["teal-hi-night"] : logoHex["teal-lo"],
    danger: scheme === "dark" ? "#f0a19a" : "#b4443a",
  } as const;
}

export type Colors = ReturnType<typeof palette>;

/** 4-based spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Radii — the same 12/16 the web uses (ADR 0012 revised). */
export const radius = { btn: 12, card: 16, chip: 999 } as const;

/**
 * Soft elevation for raised surfaces — the app's counterpart of `--card-shadow`. On
 * Android `elevation` draws the shadow; on iOS the four shadow* props do. Night mode
 * keeps a faint shadow plus a hairline border (shadows vanish on dark grounds).
 */
export function shadow(colors: Colors, scheme: Scheme, level: 1 | 2 = 1) {
  return {
    shadowColor: colors.shadowColor,
    shadowOpacity: scheme === "dark" ? 0.5 : level === 2 ? 0.14 : 0.08,
    shadowRadius: level === 2 ? 20 : 10,
    shadowOffset: { width: 0, height: level === 2 ? 10 : 4 },
    elevation: level === 2 ? 6 : 2,
    ...(scheme === "dark" ? { borderWidth: 1, borderColor: colors.hairline } : {}),
  } as const;
}

type Family =
  | "Cairo_400Regular"
  | "Cairo_700Bold"
  | "Cairo_800ExtraBold"
  | "IBMPlexSansArabic_400Regular"
  | "IBMPlexSansArabic_600SemiBold";

/**
 * Arabic text base: every role carries explicit `textAlign`/`writingDirection`
 * so a Text never depends on the ambient direction being right. Line heights
 * are the Arabic-calibrated unitless tokens, made absolute for RN.
 */
function typeStyle(role: TypeRole, fontFamily: Family) {
  const size = fontSize[role] * 16;
  return {
    fontFamily,
    fontSize: size,
    lineHeight: Math.round(size * lineHeight[role]),
    textAlign: "right" as const,
    writingDirection: "rtl" as const,
  };
}

export const text = {
  pageTitle: typeStyle("pageTitle", "Cairo_800ExtraBold"),
  section: typeStyle("section", "Cairo_700Bold"),
  cardTitle: typeStyle("cardTitle", "Cairo_700Bold"),
  body: typeStyle("body", "IBMPlexSansArabic_400Regular"),
  bodyStrong: typeStyle("body", "IBMPlexSansArabic_600SemiBold"),
  caption: typeStyle("caption", "IBMPlexSansArabic_400Regular"),
  captionStrong: typeStyle("caption", "IBMPlexSansArabic_600SemiBold"),
} as const;
