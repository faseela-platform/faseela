/**
 * Generates the grow intro as THE brand animation — one Lottie for the app splash AND the
 * landing hero (R2-B, ADR 0034; choreography = ADR 0033 "a morning, not a UI").
 *
 * The same geometry as everything else (`packages/tokens/brand.ts`). Timeline (~3.4 s + hold):
 * the book rises with real travel (0.25–1.05 s) and the spine reveals with it; the stem grows
 * near-linearly from the book's top to the tip (1.05–2.3 s) with a hair of sway; each leaf
 * unfurls from its node with a small overshoot while the stem still climbs (1.8 s / 2.1 s);
 * the veins surface and the ground shadow SPREADS under the finished plant. The old version's
 * two named defects are fixed here at the source: the stem's below-the-hardcover stub never
 * shows (the spine fraction of the trim-path reveals with the book, growth starts at the book
 * top), and each act carries its own easing — no ease-out-expo snap.
 *
 * Every path is M/L/C/Z, so it converts to Lottie bezier vertices exactly. Gradients are
 * flattened to their mid stops — Lottie gradient fills render inconsistently on Android's
 * engine, and the web crossfades to the real gradient mark when the intro ends.
 *
 *   node scripts/brand/make-lottie.mjs
 *     → apps/native/assets/brand/grow.json   (splash)
 *     → apps/web/public/brand/grow.json      (landing intro, played by lottie-web)
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
const OUTS = [
  resolve(ROOT, "apps/native/assets/brand/grow.json"),
  resolve(ROOT, "apps/web/public/brand/grow.json"),
];
const FPS = 30;
const TOTAL = 3.8; // 3.4 s of motion + a settle hold
const FRAMES = Math.round(TOTAL * FPS);
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

/** cubic-bezier(p1x,p1y,p2x,p2y) → a Lottie keyframe ease. */
const bez = (p1x, p1y, p2x, p2y) => ({ o: { x: [p1x], y: [p1y] }, i: { x: [p2x], y: [p2y] } });
/** The acts' easings (ADR 0033): each physical action gets its own. */
const RISE = bez(0.22, 0.9, 0.36, 1); // the book landing softly
const DRAW = bez(0.45, 0.05, 0.35, 0.95); // near-linear growth, soft ends
const SOFT = bez(0.33, 0, 0.3, 1); // fades
const SWAY = bez(0.37, 0, 0.63, 1); // sinusoidal lean
const UNFURL = bez(0.3, 0.05, 0.25, 1); // a leaf opening

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

/** Keyframes: pairs of [timeFrame, value, easeToNext?] — each segment carries its act's ease. */
const kf = (pairs) => ({
  a: 1,
  k: pairs.map(([t, s, e], idx) => (idx < pairs.length - 1 ? { t, s, ...(e ?? SOFT) } : { t, s })),
});
const still = (v) => ({ a: 0, k: v });

/** A shape layer: `anchor` is both the anchor and position, so shape coordinates stay absolute. */
function layer(name, shapes, { anchor = [0, 0], opacity, scale, position, rotation } = {}) {
  return {
    ddd: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
    ks: {
      o: opacity ?? still(100),
      r: rotation ?? still(0),
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

/**
 * The stem path runs foot(y=204) → book top(y=120) → tip(y=44). The straight spine
 * segment is 84 units; the curve above ≈ 78 — so the spine is ~52% of the trim.
 * That fraction reveals WITH the book (0.25–1.05 s), and visible growth runs from
 * the book's top only: no stub ever pokes below the hardcover.
 */
const SPINE_PCT = 52;

/** The book's rise: real travel (+18), the RISE easing, staggered per layer. */
const riseIn = (delay, travel = 18) => ({
  opacity: kf([
    [f(delay), [0], SOFT],
    [f(delay + 0.55), [100]],
  ]),
  position: (anchor) =>
    kf([
      [f(delay), [anchor[0], anchor[1] + travel, 0], RISE],
      [f(delay + 0.8), [anchor[0], anchor[1], 0]],
    ]),
});

const layers = [];
// Back to front (Lottie draws the LAST layer first, so push front-most first).

// veins — surface once both leaves stand
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
        [f(2.6), [0], SOFT],
        [f(3.2), [100]],
      ]),
    },
  ),
);

// leaves — unfurl from the node with a breath of overshoot, while the stem still climbs
const leaf = (name, path, anchor, t0, fromDeg) =>
  layer(name, [group([...pathToShapes(path), fill(TEAL)], "leaf")], {
    anchor,
    opacity: kf([
      [f(t0), [0], SOFT],
      [f(t0 + 0.45), [100]],
    ]),
    scale: kf([
      [f(t0), [15, 15, 100], UNFURL],
      [f(t0 + 0.75), [106, 106, 100], UNFURL],
      [f(t0 + 1.0), [100, 100, 100]],
    ]),
    rotation: kf([
      [f(t0), [fromDeg], UNFURL],
      [f(t0 + 0.75), [-fromDeg / 9], UNFURL],
      [f(t0 + 1.0), [0]],
    ]),
  });
layers.push(leaf("leaf-upper", P.leafUpper, [121, 64], 2.1, 28));
layers.push(leaf("leaf-lower", P.leafLower, [119, 86], 1.8, -28));

// stem growth — ONLY the above-book portion ever draws (trim starts at the spine
// fraction), so no stub can grow from the foot; a hair of sway around the book top
layers.push(
  layer(
    "stem",
    [
      group(
        [
          ...pathToShapes(P.stem),
          stroke(GOLD, S.stem),
          {
            ty: "tm",
            s: still(SPINE_PCT),
            e: kf([
              [f(1.05), [SPINE_PCT], DRAW],
              [f(2.3), [100]],
            ]),
            o: still(0),
            m: 1,
          },
        ],
        "stem",
      ),
    ],
    {
      anchor: [120, 120],
      rotation: kf([
        [f(1.1), [0], SWAY],
        [f(2.0), [1.4], SWAY],
        [f(2.5), [-0.5], SWAY],
        [f(2.9), [0]],
      ]),
    },
  ),
);
// spine — part of the BOOK, not of growth: it rides in with the covers' rise,
// already whole, exactly like the static mark's gold spine
{
  const a = [120, 160];
  const s = riseIn(0.25);
  layers.push(
    layer(
      "spine",
      [
        group(
          [
            ...pathToShapes(P.stem),
            stroke(GOLD, S.stem),
            { ty: "tm", s: still(0), e: still(SPINE_PCT), o: still(0), m: 1 },
          ],
          "spine",
        ),
      ],
      { anchor: a, opacity: s.opacity, position: s.position(a) },
    ),
  );
}

// page lines
{
  const a = [120, 160];
  const s = riseIn(0.55, 12);
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
  const s = riseIn(0.25);
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
  const s = riseIn(0.25);
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
// ground shadow — cast, not faded: it spreads as the plant completes
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
      anchor: [MARK_GROUND.cx, MARK_GROUND.cy],
      opacity: kf([
        [f(2.4), [0], SOFT],
        [f(3.1), [100]],
      ]),
      scale: kf([
        [f(2.4), [60, 100, 100], RISE],
        [f(3.1), [100, 100, 100]],
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
  meta: { g: "scripts/brand/make-lottie.mjs — from packages/tokens/brand.ts (ADR 0029/0033/0034)" },
};
const json = JSON.stringify(lottie);
for (const out of OUTS) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log("wrote", out.replace(ROOT, "."), Math.round(json.length / 1024), "KB");
}
console.log(layers.length, "layers,", FRAMES, "frames,", TOTAL, "s");
