/**
 * The Faseela mark — logo 6a, the owner's approved design (2026-08-28):
 * «1a مع عروق الأوراق، كعب ذهبي متّصل بالساق، صفحات رفيعة تحت الغلاف، ولمسات واقعية خفيفة».
 *
 * This file is the SINGLE SOURCE of the mark's geometry. Everything that draws it —
 * the web `<Mark>` component, the Next/Expo icon renders, the WebGL geometry, the
 * Lottie generator and the social exports — reads these constants. Edit here, never
 * in a consumer.
 *
 * Coordinates are in the 240×230 viewBox (x 0–240, y 0–230). Every path is M/L/C/Z
 * only — no arcs — so it converts exactly to three.js shapes and Lottie vertices.
 * The book's baseline (the spine's base) is at (120, 202); the ground ellipse sits at
 * y = 216. Source: `assets/brand/logo-6a.svg` (ADR 0029).
 */

export const MARK_VIEWBOX = { width: 240, height: 230 } as const;

/** Where the spine meets the book — the origin of the seedling and of the land. */
export const MARK_SPINE_BASE = { x: 120, y: 202 } as const;

/** Where the stem ends — the tip the leaves grow from. */
export const MARK_STEM_TIP = { x: 118, y: 44 } as const;

export const MARK_PATHS = {
  /** Thin paper block visible below the covers. */
  paperEdge:
    "M120 209 C 92 201, 57 198, 28 191 L 28 184 C 57 191, 92 194, 120 202 C 148 194, 183 191, 212 184 L 212 191 C 183 198, 148 201, 120 209 Z",
  /** The paper block's hairline, hinting at page edges. */
  paperLine: "M31 187 C 58 194, 92 197, 118 204 M209 187 C 182 194, 148 197, 122 204",
  /** Right cover (reader's right; under dir=rtl it is the near page). */
  coverRight: "M120 202 C 92 194, 56 191, 26 184 L 26 110 C 56 103, 92 106, 120 120 Z",
  coverLeft: "M120 202 C 148 194, 184 191, 214 184 L 214 110 C 184 103, 148 106, 120 120 Z",
  /** A faint white sheen along the top edge of each cover. */
  sheenRight: "M30 112 C 58 106, 90 109, 114 120 L 114 126 C 90 115, 58 112, 30 118 Z",
  sheenLeft: "M210 112 C 182 106, 150 109, 126 120 L 126 126 C 150 115, 182 112, 210 118 Z",
  /** Three text lines per page. */
  linesRight:
    "M42 128 C 66 122, 94 124, 112 134 M42 146 C 66 140, 94 142, 112 152 M42 164 C 66 158, 94 160, 112 170",
  linesLeft:
    "M198 128 C 174 122, 146 124, 128 134 M198 146 C 174 140, 146 142, 128 152 M198 164 C 174 158, 146 160, 128 170",
  /** The gold stem — one stroke from the paper's foot up through the spine to the tip. */
  stem: "M120 204 L 120 120 C 116 96, 126 74, 118 44",
  leafLower: "M119 86 C 98 88, 82 74, 82 52 C 104 50, 120 64, 119 86 Z",
  leafUpper: "M121 64 C 142 66, 158 52, 158 30 C 136 28, 120 42, 121 64 Z",
  veinLower: "M116 81 C 106 73, 98 65, 92 57",
  veinUpper: "M124 59 C 134 51, 142 43, 148 35",
} as const;

export type MarkPathName = keyof typeof MARK_PATHS;

/** The ground shadow under the book (an ellipse, not a path). */
export const MARK_GROUND = { cx: 120, cy: 216, rx: 92, ry: 10 } as const;

/**
 * The mark's own colours (sRGB hex, as designed). The web reads the token roles
 * `--teal-hi/lo` and `--gold-hi/lo` first and falls back to these; native and the
 * render scripts use them directly.
 */
export const MARK_COLORS = {
  tealHi: "#1ecfae",
  tealLo: "#0e9b82",
  goldHi: "#e3bd4e",
  goldLo: "#b18f2f",
  /** The night palette's stops — lighter, slightly desaturated, so they hold on paper-950. */
  tealHiNight: "#35e2c2",
  tealLoNight: "#14b899",
  goldHiNight: "#ecd08a",
  goldLoNight: "#c7a958",
  paperHi: "#fbfaf3",
  paperLo: "#e8e6d8",
  paperLine: "#cbc8b6",
  pageLine: "#f7fbfa",
  vein: "#eafffa",
  shadow: "#134e42",
  glow: "#0e9b82",
} as const;

/** Stroke widths in viewBox units. */
export const MARK_STROKES = { stem: 4.5, lines: 2, vein: 1.3, paperLine: 0.9 } as const;
