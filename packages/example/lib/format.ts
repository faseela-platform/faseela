/**
 * Private implementation. Nothing outside packages/example may import this.
 *
 * Digits render left-to-right inside right-to-left text, so a number sitting
 * next to Arabic needs isolating or it visually jumps across adjacent
 * punctuation. FSI (U+2068) opens an isolate, PDI (U+2069) closes it.
 * See .claude/skills/faseela-arabic-rtl/SKILL.md.
 */
const FIRST_STRONG_ISOLATE = "\u2068";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

export function formatPointTotal(points: number): string {
  const digits = new Intl.NumberFormat("ar-LB").format(points);
  return `${FIRST_STRONG_ISOLATE}${digits}${POP_DIRECTIONAL_ISOLATE}`;
}
