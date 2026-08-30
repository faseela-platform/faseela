import { MARK_PATHS, MARK_SPINE_BASE, MARK_STROKES, MARK_VIEWBOX } from "@faseela/tokens/brand";
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  type BufferGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Logo 6a as three.js geometry — built from the SAME path strings the SVG mark draws
 * (`@faseela/tokens/brand`), so the 3D mark is the mark, not an interpretation of it (ADR 0029).
 *
 * Coordinates stay in viewBox units (240×230) but are flipped to y-up AT PARSE TIME — the paths
 * are wrapped in `<g transform="scale(1,-1)">` so `SVGLoader` emits y-up points and
 * `toShapes` fixes the winding. Flipping with a negative group scale instead inverted the
 * lighting (the first attempt rendered the covers as a dark slab). The orthographic camera
 * frames the box from y=0 down to y=−230, which keeps the canvas aligned pixel-for-pixel over
 * the CSS mark it replaces.
 *
 * What each SVG construct becomes, so the WebGL mark reads as the logo and not as a cut-out:
 *
 * - Filled shapes (covers, paper, leaves) → shallow extrusions with a *small* bevel. The bevel
 *   is what lets a light catch the edge; a large one outlines every part like a sticker.
 * - The SVG's vertical gradients (`x1=0 y1=0 x2=0 y2=1`, per element bounding box) → **vertex
 *   colours** painted top-to-bottom over each part's own bounding box (`paintGradient`). This
 *   is how a gradient survives into a lit 3D material: the material's colour is white and
 *   `vertexColors` carries the brand stops, so the tokens are what the eye sees.
 * - Stroked paths drawn ON a surface (page lines, leaf veins) → flat ribbons from
 *   `SVGLoader.pointsToStroke`, lying a hair above the face, unlit. As tubes they shaded like
 *   pipes; the SVG draws them as flat translucent strokes, and so does this.
 * - The stem — the one stroke that IS a 3D thing — → a tube along its own curve, gold gradient
 *   along its height.
 */

export type MarkPart = "paper" | "coverRight" | "coverLeft" | "leafLower" | "leafUpper" | "stem";

const loader = new SVGLoader();

const svgYUp = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="${d}"/></g></svg>`;

function shapesOf(d: string) {
  const { paths } = loader.parse(svgYUp(d));
  // `createShapes` is deprecated in three 0.185; `toShapes` reads the fill rule from the path.
  return paths.flatMap((p) => p.toShapes());
}

function extrude(d: string, depth: number, bevel: number): BufferGeometry {
  return new ExtrudeGeometry(shapesOf(d), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
}

/** Every subpath of a stroked path (`M … M …`) as a flat ribbon of the given width. */
function ribbons(d: string, width: number): BufferGeometry[] {
  const { paths } = loader.parse(svgYUp(d));
  const style = SVGLoader.getStrokeStyle(width, "#fff", "round", "round", 4);
  return (paths[0]?.subPaths ?? []).map((sub) =>
    SVGLoader.pointsToStroke(sub.getSpacedPoints(24), style, 12, 0.001),
  );
}

function stemTube(): BufferGeometry {
  const { paths } = loader.parse(svgYUp(MARK_PATHS.stem));
  const sub = paths[0]?.subPaths[0];
  if (!sub) throw new Error("stem path did not parse");
  const points = sub.getSpacedPoints(48).map((p) => new Vector3(p.x, p.y, 0));
  // Radius a fifth over the stroke's half-width: a lit tube's sides fall into shadow, so its
  // visible face reads narrower than a flat stroke of the same width. Measured against the
  // SVG stem, not assumed.
  return new TubeGeometry(new CatmullRomCurve3(points), 48, MARK_STROKES.stem * 0.6, 10, false);
}

/**
 * Paint a top→bottom gradient into the geometry's `color` attribute over its own bounding box —
 * the SVG's `objectBoundingBox` gradient, per part. Re-run on a theme change with the night stops.
 */
export function paintGradient(geometry: BufferGeometry, top: Color, bottom: Color) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const pos = geometry.getAttribute("position");
  const span = Math.max(box.max.y - box.min.y, 1e-6);
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (box.max.y - pos.getY(i)) / span; // 0 at the top, 1 at the bottom
    c.copy(top).lerp(bottom, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.getAttribute("color").needsUpdate = true;
}

export type MarkGeometry = Record<MarkPart, BufferGeometry> & {
  /** The six page lines, flat on the covers' front face. */
  lines: BufferGeometry[];
  /** The two leaf veins, flat on the leaves. */
  veins: BufferGeometry[];
};

/** Depth per part, in viewBox units. Covers thickest; leaves thin; the stem sits proud of the spine. */
export function buildMarkGeometry(): MarkGeometry {
  return {
    paper: extrude(MARK_PATHS.paperEdge, 4, 0.4),
    coverRight: extrude(MARK_PATHS.coverRight, 6, 0.5),
    coverLeft: extrude(MARK_PATHS.coverLeft, 6, 0.5),
    leafLower: extrude(MARK_PATHS.leafLower, 2.5, 0.5),
    leafUpper: extrude(MARK_PATHS.leafUpper, 2.5, 0.5),
    stem: stemTube(),
    lines: [
      ...ribbons(MARK_PATHS.linesRight, MARK_STROKES.lines),
      ...ribbons(MARK_PATHS.linesLeft, MARK_STROKES.lines),
    ],
    veins: [
      ...ribbons(MARK_PATHS.veinLower, MARK_STROKES.vein),
      ...ribbons(MARK_PATHS.veinUpper, MARK_STROKES.vein),
    ],
  };
}

/** Z of each part's front face (extrusion depth + bevel), where the flat strokes lie. */
export const MARK_Z = {
  paper: -2,
  coverFace: 6.5,
  lines: 6.8,
  leaves: 8,
  leafFace: 8 + 2.5 + 0.5,
  veins: 8 + 2.5 + 0.8,
  stem: 5,
} as const;

/** The point the group rotates about — the spine's base, in y-up units — and the frame the camera shows. */
export const MARK_PIVOT = { x: MARK_SPINE_BASE.x, y: -MARK_SPINE_BASE.y } as const;
export const MARK_FRAME = MARK_VIEWBOX;
