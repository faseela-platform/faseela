import { MARK_PATHS, MARK_SPINE_BASE, MARK_STROKES, MARK_VIEWBOX } from "@faseela/tokens/brand";
import {
  CatmullRomCurve3,
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
 * `createShapes` fixes the winding. Flipping with a negative group scale instead inverted the
 * lighting (the first attempt rendered the covers as a dark slab). The orthographic camera
 * frames the box from y=0 down to y=−230, which keeps the canvas aligned pixel-for-pixel over
 * the CSS mark it replaces.
 *
 * Filled shapes become shallow extrusions with a small bevel (the light catches the edge); the
 * stem, the page lines and the leaf veins become thin tubes along their own curves, so the
 * cross-fade from the SVG drops nothing.
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

function extrude(d: string, depth: number, bevel = 1): BufferGeometry {
  return new ExtrudeGeometry(shapesOf(d), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
}

/** Every subpath of a stroked path (`M … M …`) as a tube of the given radius at depth z. */
function tubes(d: string, radius: number, z: number, segments = 24): BufferGeometry[] {
  const { paths } = loader.parse(svgYUp(d));
  return (paths[0]?.subPaths ?? []).map((sub) => {
    const points = sub.getSpacedPoints(segments).map((p) => new Vector3(p.x, p.y, z));
    return new TubeGeometry(new CatmullRomCurve3(points), segments, radius, 8, false);
  });
}

function stemTube(): BufferGeometry {
  const [stem] = tubes(MARK_PATHS.stem, MARK_STROKES.stem / 2, 4, 48);
  if (!stem) throw new Error("stem path did not parse");
  return stem;
}

export type MarkGeometry = Record<MarkPart, BufferGeometry> & {
  /** The six page lines, in the paper colour, lying on the covers' front face. */
  lines: BufferGeometry[];
  /** The two leaf veins, lying on the leaves. */
  veins: BufferGeometry[];
};

/** Depth per part, in viewBox units. Covers thickest; leaves thin; the stem sits proud of the spine. */
export function buildMarkGeometry(): MarkGeometry {
  return {
    paper: extrude(MARK_PATHS.paperEdge, 4, 0.6),
    coverRight: extrude(MARK_PATHS.coverRight, 6),
    coverLeft: extrude(MARK_PATHS.coverLeft, 6),
    leafLower: extrude(MARK_PATHS.leafLower, 3, 0.8),
    leafUpper: extrude(MARK_PATHS.leafUpper, 3, 0.8),
    stem: stemTube(),
    lines: [
      ...tubes(MARK_PATHS.linesRight, MARK_STROKES.lines / 2, 7.2),
      ...tubes(MARK_PATHS.linesLeft, MARK_STROKES.lines / 2, 7.2),
    ],
    veins: [
      ...tubes(MARK_PATHS.veinLower, MARK_STROKES.vein / 2, 10.2, 12),
      ...tubes(MARK_PATHS.veinUpper, MARK_STROKES.vein / 2, 10.2, 12),
    ],
  };
}

/** The point the group rotates about — the spine's base, in y-up units — and the frame the camera shows. */
export const MARK_PIVOT = { x: MARK_SPINE_BASE.x, y: -MARK_SPINE_BASE.y } as const;
export const MARK_FRAME = MARK_VIEWBOX;
