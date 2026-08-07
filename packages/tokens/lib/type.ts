export type TypeRole =
  | 'caption'
  | 'bodySm'
  | 'body'
  | 'bodyLg'
  | 'lede'
  | 'cardTitle'
  | 'section'
  | 'pageTitle'
  | 'display'
  | 'hero'
  | 'heroLg';

/** Sizes in rem. 1.25 ratio on a 16px root. Role-named, because a size name does not police its own use. */
export const fontSize: Record<TypeRole, number> = {
  caption: 0.8,
  bodySm: 0.9,
  body: 1,
  bodyLg: 1.125,
  /*
   * Editorial lede. The reference site runs a 23px body against a 68px display — a ratio under 3x,
   * where a large hero over a 16px body gives ~8x. Arabic reads slightly larger than Latin at the
   * same px, so 1.25rem is the Arabic counterpart of that measure rather than a copy of the number.
   */
  lede: 1.25,
  cardTitle: 1.25,
  section: 1.563,
  pageTitle: 1.953,
  display: 2.441,
  hero: 3.052,
  heroLg: 3.815,
};

/**
 * Unitless line heights, paired with the sizes above.
 *
 * These are Arabic-calibrated. Measured from font binaries, the Arabic ink band —
 * ascenders, descenders, and the vowel stack — spans 1.07x to 1.61x the Latin extent in
 * the same face at the same size. Cairo, the display font, measures 1.393.
 *
 * Two consequences that differ from Latin practice:
 *
 * - Display leading never drops below 1.42. Large Arabic type does not get tighter
 *   leading the way Latin does, because the diacritics scale with it.
 * - Body is 1.75, not Latin's 1.5. The Arabic ink band consumes more of the line box, so
 *   matching the *perceived* rhythm requires the larger number.
 *
 * Never rely on `line-height: normal`. Arabic fonts' declared metrics frequently disagree
 * with their own ink — Almarai clips its own glyphs at the browser default.
 */
export const lineHeight: Record<TypeRole, number> = {
  caption: 1.6,
  bodySm: 1.7,
  body: 1.75,
  bodyLg: 1.7,
  lede: 1.7,
  cardTitle: 1.5,
  section: 1.45,
  pageTitle: 1.45,
  display: 1.42,
  hero: 1.42,
  heroLg: 1.42,
};
