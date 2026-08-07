export type ScaleStep =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '950';

export type ColorScale = Record<ScaleStep, string>;

/**
 * Primary. Sampled from the seedling's leaves and the book in Faseela's logo.
 *
 * The brand value (step 400, `oklch(0.684 0.124 178.3)` in the logo itself) sits at 99%
 * of the sRGB chroma ceiling for its lightness. There is no more saturated teal
 * available, and it clips under `opacity` and `filter`. Composite it at full strength.
 */
export const seedling: ColorScale = {
  '50': 'oklch(0.97 0.004 178.3)',
  '100': 'oklch(0.895 0.046 178.3)',
  '200': 'oklch(0.82 0.075 178.3)',
  '300': 'oklch(0.745 0.096 178.3)',
  '400': 'oklch(0.67 0.105 178.3)',
  '500': 'oklch(0.595 0.093 178.3)',
  '600': 'oklch(0.52 0.075 178.3)',
  '700': 'oklch(0.445 0.052 178.3)',
  '800': 'oklch(0.37 0.033 178.3)',
  '900': 'oklch(0.295 0.017 178.3)',
  '950': 'oklch(0.22 0.009 178.3)',
};

/** Accent. Sampled from the stem, the wordmark, and the ornamental border. */
export const stem: ColorScale = {
  '50': 'oklch(0.97 0.004 89.8)',
  '100': 'oklch(0.895 0.037 89.8)',
  '200': 'oklch(0.82 0.084 89.8)',
  '300': 'oklch(0.745 0.107 89.8)',
  '400': 'oklch(0.67 0.116 89.8)',
  '500': 'oklch(0.595 0.103 89.8)',
  '600': 'oklch(0.52 0.083 89.8)',
  '700': 'oklch(0.445 0.058 89.8)',
  '800': 'oklch(0.37 0.036 89.8)',
  '900': 'oklch(0.295 0.019 89.8)',
  '950': 'oklch(0.22 0.01 89.8)',
};

/**
 * Neutral. The logo's paper measures chroma exactly 0; this ramp carries a
 * near-imperceptible teal cast so surfaces feel of-a-piece with the brand. ADR 0010.
 */
export const paper: ColorScale = {
  '50': 'oklch(0.985 0.004 178.3)',
  '100': 'oklch(0.902 0.004 178.3)',
  '200': 'oklch(0.82 0.004 178.3)',
  '300': 'oklch(0.738 0.004 178.3)',
  '400': 'oklch(0.655 0.004 178.3)',
  '500': 'oklch(0.573 0.004 178.3)',
  '600': 'oklch(0.49 0.006 178.3)',
  '700': 'oklch(0.408 0.006 178.3)',
  '800': 'oklch(0.325 0.006 178.3)',
  '900': 'oklch(0.243 0.006 178.3)',
  '950': 'oklch(0.16 0.006 178.3)',
};

export const lightRoles = {
  surface: paper['50'],
  surfaceRaised: 'white',
  border: paper['200'],
  ink: paper['950'],
  inkMuted: paper['500'],
  brand: seedling['500'],
  brandFill: seedling['400'],
  accent: stem['500'],
  accentFill: stem['400'],
} as const;

/**
 * Dark roles are not the light roles inverted step-for-step. APCA on `paper-950` puts
 * `seedling-500` at Lc 35.8, below even the large-text floor of 45, so brand roles move
 * to steps 100-200 where `seedling-200` reaches Lc 72.5.
 */
export const darkRoles = {
  surface: paper['950'],
  surfaceRaised: paper['900'],
  border: paper['800'],
  ink: paper['50'],
  inkMuted: paper['400'],
  brand: seedling['200'],
  brandFill: seedling['300'],
  accent: stem['200'],
  accentFill: stem['300'],
} as const;
