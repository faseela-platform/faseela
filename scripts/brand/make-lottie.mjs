/**
 * Generates the grow intro as a Lottie animation for the app splash — T1b, ADR 0029.
 *
 * The same geometry as everything else (`packages/tokens/brand.ts`) and the same
 * choreography as `apps/web/app/landing.css`'s grow intro: covers settle up (0–0.6 s), the stem
 * draws from the spine to the tip (0.35–1.25 s), the leaves unfurl from their base (0.85 s and
 * 1.05 s), the veins and ground shadow fade in (1.35 s). 30 fps, 2 s total including a hold.
 *
 * Every path is M/L/C/Z, so it converts to Lottie bezier vertices exactly. Gradients are
 * flattened to their mid stops — Lottie gradient fills exist but render inconsistently on
 * Android's engine, and at splash size the difference is invisible.
 *
 *   node scripts/brand/make-lottie.mjs   →   apps/native/assets/brand/grow.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MARK_COLORS,
  MARK_GROUND,
  MARK_PATHS,
  MARK_STROKES,
  MARK_VIEWBOX,
} from "../../packages/tokens/brand.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "apps/native/assets/brand/grow.json");
const FPS = 30;
const FRAMES = 60;
const f = (seconds) => Math.round(seconds * FPS);

/** #rrggbb → Lottie [r,g,b,1] in 0..1. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
/** Mid stop of a gradient, as the flat colour. */
const mid = (a, b) => {
  const A = rgb(a),
    B = rgb(b);
  return [0, 1, 2].map((i) => (A[i] + B[i]) / 2).concat(1);
};
const TEAL = mid(MARK_COLORS.tealHi, MARK_COLORS.tealLo);
const GOLD = mid(MARK_COLORS.goldHi, MARK_COLORS.goldLo);
const PAPER = mid(MARK_COLORS.paperHi, MARK_COLORS.paperLo);

/**
 * SVG path → Lottie shape(s). Lottie stores vertices `v`, and tangents `i`/`o` RELATIVE to
 * each vertex; a line segment is two zero tangents, a cubic keeps its control points.
 * Multiple `M` subpaths become multiple shapes.
 */
function pathToShapes(d) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const shapes = [];
  let cur = null,
    x = 0,
    y = 0,
    k = 0;
  const num = () => parseFloat(tokens[k++]);
  const start = () => {
    cur = { v: [], i: [], o: [], c: false };
    shapes.push(cur);
  };
  while (k < tokens.length) {
    const t = tokens[k++];
    if (t === "M") {
      start();
      x = num();
      y = num();
      cur.v.push([x, y]);
      cur.i.push([0, 0]);
      cur.o.push([0, 0]);
    } else if (t === "L") {
      x = num();
      y = num();
      cur.v.push([x, y]);
      cur.i.push([0, 0]);
      cur.o.push([0, 0]);
    } else if (t === "C") {
      const x1 = num(),
        y1 = num(),
        x2 = num(),
        y2 = num(),
        nx = num(),
        ny = num();
      cur.o[cur.o.length - 1] = [x1 - x, y1 - y];
      cur.v.push([nx, ny]);
      cur.i.push([x2 - nx, y2 - ny]);
      cur.o.push([0, 0]);
      x = nx;
      y = ny;
    } else if (t === "Z") {
      cur.c = true;
    }
  }
  return shapes.map((s) => ({ ty: "sh", ks: { a: 0, k: s } }));
}

const easeOut = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } };
const kf = (pairs) => ({
  a: 1,
  k: pairs.map(([t, s], idx) => (idx < pairs.length - 1 ? { t, s, ...easeOut } : { t, s })),
});
const still = (v) => ({ a: 0, k: v });

/** A shape layer: `anchor` is both the anchor and position, so shape coordinates stay absolute. */
function layer(name, shapes, { anchor = [0, 0], opacity, scale, position, from = 0 } = {}) {
  return {
    ddd: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ip: from,
    op: FRAMES,
    st: 0,
    bm: 0,
    ks: {
      o: opacity ?? still(100),
      r: still(0),
      p: position ?? still([anchor[0], anchor[1], 0]),
      a: still([anchor[0], anchor[1], 0]),
      s: scale ?? still([100, 100, 100]),
    },
    shapes,
  };
}
const fill = (color, opacity = 100) => ({ ty: "fl", c: still(color), o: still(opacity), r: 1 });
const stroke = (color, width, opacity = 100) => ({
  ty: "st",
  c: still(color),
  o: still(opacity),
  w: still(width),
  lc: 2,
  lj: 2,
});
const group = (items, name) => ({
  ty: "gr",
  nm: name,
  it: [
    ...items,
    {
      ty: "tr",
      p: still([0, 0]),
      a: still([0, 0]),
      s: still([100, 100]),
      r: still(0),
      o: still(100),
    },
  ],
});

const P = MARK_PATHS,
  S = MARK_STROKES;
const settle = (delay = 0) => ({
  opacity: kf([
    [f(delay), [0]],
    [f(delay + 0.6), [100]],
  ]),
  position: (anchor) =>
    kf([
      [f(delay), [anchor[0], anchor[1] + 6, 0]],
      [f(delay + 0.6), [anchor[0], anchor[1], 0]],
    ]),
});

const layers = [];
// Back to front (Lottie draws the LAST layer first, so push front-most first).
// veins
layers.push(
  layer(
    "veins",
    [
      group(
        [
          ...pathToShapes(P.veinLower),
          ...pathToShapes(P.veinUpper),
          stroke(rgb(MARK_COLORS.vein), S.vein, 95),
        ],
        "veins",
      ),
    ],
    {
      opacity: kf([
        [f(1.35), [0]],
        [f(1.85), [100]],
      ]),
    },
  ),
);
// leaves: each scales from its base at the stem
layers.push(
  layer("leaf-upper", [group([...pathToShapes(P.leafUpper), fill(TEAL)], "leaf")], {
    anchor: [121, 64],
    scale: kf([
      [f(1.05), [50, 50, 100]],
      [f(1.75), [100, 100, 100]],
    ]),
    opacity: kf([
      [f(1.05), [0]],
      [f(1.35), [100]],
    ]),
  }),
);
layers.push(
  layer("leaf-lower", [group([...pathToShapes(P.leafLower), fill(TEAL)], "leaf")], {
    anchor: [119, 86],
    scale: kf([
      [f(0.85), [50, 50, 100]],
      [f(1.55), [100, 100, 100]],
    ]),
    opacity: kf([
      [f(0.85), [0]],
      [f(1.15), [100]],
    ]),
  }),
);
// stem: trim path 0→100 draws it from the foot upward
layers.push(
  layer("stem", [
    group(
      [
        ...pathToShapes(P.stem),
        stroke(GOLD, S.stem),
        {
          ty: "tm",
          s: still(0),
          e: kf([
            [f(0.35), [0]],
            [f(1.25), [100]],
          ]),
          o: still(0),
          m: 1,
        },
      ],
      "stem",
    ),
  ]),
);
// page lines
{
  const a = [120, 160];
  const s = settle(0.15);
  layers.push(
    layer(
      "lines",
      [
        group(
          [
            ...pathToShapes(P.linesRight),
            ...pathToShapes(P.linesLeft),
            stroke(rgb(MARK_COLORS.pageLine), S.lines, 70),
          ],
          "lines",
        ),
      ],
      { anchor: a, opacity: s.opacity, position: s.position(a) },
    ),
  );
}
// covers (+ sheen)
{
  const a = [120, 160];
  const s = settle(0);
  layers.push(
    layer(
      "covers",
      [
        group([...pathToShapes(P.coverRight), ...pathToShapes(P.coverLeft), fill(TEAL)], "covers"),
        group(
          [...pathToShapes(P.sheenRight), ...pathToShapes(P.sheenLeft), fill([1, 1, 1, 1], 20)],
          "sheen",
        ),
      ],
      { anchor: a, opacity: s.opacity, position: s.position(a) },
    ),
  );
}
// paper block
{
  const a = [120, 196];
  const s = settle(0);
  layers.push(
    layer(
      "paper",
      [
        group([...pathToShapes(P.paperEdge), fill(PAPER)], "paper"),
        group(
          [...pathToShapes(P.paperLine), stroke(rgb(MARK_COLORS.paperLine), S.paperLine, 90)],
          "paper-line",
        ),
      ],
      { anchor: a, opacity: s.opacity, position: s.position(a) },
    ),
  );
}
// ground shadow (an ellipse)
layers.push(
  layer(
    "shadow",
    [
      group(
        [
          {
            ty: "el",
            p: still([MARK_GROUND.cx, MARK_GROUND.cy]),
            s: still([MARK_GROUND.rx * 2, MARK_GROUND.ry * 2]),
          },
          fill(rgb(MARK_COLORS.shadow), 14),
        ],
        "shadow",
      ),
    ],
    {
      opacity: kf([
        [f(1.35), [0]],
        [f(1.85), [100]],
      ]),
    },
  ),
);

const lottie = {
  v: "5.9.0",
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: MARK_VIEWBOX.width,
  h: MARK_VIEWBOX.height,
  nm: "faseela-grow",
  ddd: 0,
  assets: [],
  layers,
  meta: { g: "scripts/brand/make-lottie.mjs — from packages/tokens/brand.ts (ADR 0029)" },
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(lottie));
console.log(
  "wrote",
  OUT.replace(ROOT, "."),
  Math.round(JSON.stringify(lottie).length / 1024),
  "KB,",
  layers.length,
  "layers,",
  FRAMES,
  "frames",
);
