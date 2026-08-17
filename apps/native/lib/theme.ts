/**
 * Brand tokens mapped to React Native styles. Colors come from the hex mirror
 * (`@faseela/tokens/native`) because RN cannot parse `oklch()`. Type sizes are
 * rem-based in the token package; RN wants absolute points, so ×16 here.
 *
 * Font weights are distinct families in RN — `Cairo_700Bold` is a family name,
 * never `fontWeight` alone.
 */

import {
  fontSize,
  lightRolesNative,
  lineHeight,
  stemHex,
  type TypeRole,
} from "@faseela/tokens/native";

export const colors = {
  ...lightRolesNative,
  /** Points-chip tones — olive-gold, quiet enough to repeat down a list. */
  chipBg: stemHex["100"],
  chipInk: stemHex["700"],
} as const;

/** 4-based spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 16, chip: 999 } as const;

type Family =
  | "Cairo_400Regular"
  | "Cairo_700Bold"
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
  pageTitle: typeStyle("pageTitle", "Cairo_700Bold"),
  section: typeStyle("section", "Cairo_700Bold"),
  cardTitle: typeStyle("cardTitle", "Cairo_700Bold"),
  body: typeStyle("body", "IBMPlexSansArabic_400Regular"),
  bodyStrong: typeStyle("body", "IBMPlexSansArabic_600SemiBold"),
  caption: typeStyle("caption", "IBMPlexSansArabic_400Regular"),
} as const;
