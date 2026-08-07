/**
 * Motion tokens in milliseconds, for Motion's `transition` objects and for React Native,
 * neither of which can read a CSS custom property.
 */
export const duration = {
  hover: 130,
  press: 150,
  popover: 180,
  modal: 240,
  modalExit: 170,
  drawer: 290,
  drawerExit: 200,
  page: 360,
} as const;

/**
 * Cubic-bezier control points, in Motion's array form.
 *
 * `enter` is the workhorse. `exit` is the only place an ease-in shape is legitimate —
 * alone it delays feedback and feels sluggish, but as the exit half of a pairing it reads
 * correctly, because the user has already decided to leave.
 */
export const easing = {
  enter: [0.32, 0.72, 0, 1],
  move: [0.4, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  hover: [0.25, 0.1, 0, 1],
} as const;

/**
 * Travel distances in px. Fixed, never a percentage of the element's own size: an exit
 * that travels its own height reads as the element falling out of the document rather
 * than as a dismissal.
 */
export const travel = {
  sm: 4,
  md: 8,
  lg: 16,
} as const;

/**
 * Stagger offsets in ms. `word` is the one used for Arabic display type — splitting
 * Arabic at word boundaries preserves every cursive join, while letter-level splitting
 * destroys them, so `word` is the finest granularity available to us.
 */
export const stagger = {
  word: 70,
  item: 90,
  section: 100,
} as const;
