/**
 * Design tokens as values, for the places CSS cannot reach: Motion transitions,
 * React Native styles, canvas, and tests that assert on the system.
 *
 * `theme.css` is the source of truth for the web. This file mirrors it. The mirror is
 * checked by `tests/parity.test.ts`, which parses the CSS and fails if the two drift —
 * a duplicated constant nobody verifies is worse than no constant at all.
 */

export {
  seedling,
  stem,
  paper,
  logo,
  lightRoles,
  darkRoles,
  type ColorScale,
  type LogoStop,
  type ScaleStep,
} from "./lib/colors.js";

export { duration, easing, travel, stagger } from "./lib/motion.js";

export { fontSize, lineHeight, type TypeRole } from "./lib/type.js";
