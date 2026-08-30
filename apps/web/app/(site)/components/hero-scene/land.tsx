import { MARK_SPINE_BASE, MARK_VIEWBOX } from "@faseela/tokens/brand";

/**
 * The land under the mark — T-A decision A, «الكتاب يفتح الأرض».
 *
 * Four terraces, each the book cover's own bottom curve scaled about the spine's base and set
 * on a flat horizon, every terrace one step lower than the last. The shapes are derived from
 * the mark's geometry so the ground and the logo share one shape language — the coherence the
 * owner asked for after the free-drawn hills.
 *
 * Coordinates are in STAGE units (the 460×500 box that `mark-3d.tsx` lays the mark out in), and
 * the SVG is sized as a multiple of the stage, so the terraces stay attached to the spine at
 * every viewport width without any JavaScript measuring anything.
 */

/** Where the mark sits inside the 460×500 stage (must match mark-3d.tsx). */
export const STAGE = { width: 460, height: 500, markX: 30, markY: 60, markWidth: 400 } as const;

const s = STAGE.markWidth / MARK_VIEWBOX.width; // px per viewBox unit
const bx = STAGE.markX + MARK_SPINE_BASE.x * s;
const by = STAGE.markY + MARK_SPINE_BASE.y * s;

/** The SVG spans 3200 stage units, centred on the spine, and 700 tall from the stage's top. */
const VIEW = { x: bx - 1600, y: 0, w: 3200, h: 700 } as const;

const TERRACES = [1.6, 2.4, 3.4, 4.8].map((k, i) => {
  const drop = (i + 1) * 26;
  const X = (vx: number) => bx + (vx - MARK_SPINE_BASE.x) * s * k;
  const Y = (vy: number) => by + drop + (vy - MARK_SPINE_BASE.y) * s * k * 0.55;
  const yEdge = Y(184);
  return `M ${VIEW.x - 200} ${yEdge} L ${X(26)} ${yEdge} C ${X(56)} ${Y(191)}, ${X(92)} ${Y(194)}, ${X(120)} ${Y(202)} C ${X(148)} ${Y(194)}, ${X(184)} ${Y(191)}, ${X(214)} ${yEdge} L ${VIEW.x + VIEW.w + 200} ${yEdge} L ${VIEW.x + VIEW.w + 200} ${VIEW.h + 200} L ${VIEW.x - 200} ${VIEW.h + 200} Z`;
});

export function Land() {
  return (
    <svg
      aria-hidden="true"
      className="hero-land pointer-events-none absolute top-0 left-1/2"
      style={{
        width: `${(VIEW.w / STAGE.width) * 100}%`,
        height: `${(VIEW.h / STAGE.height) * 100}%`,
        marginLeft: `-${(VIEW.w / 2 / STAGE.width) * 100}%`,
      }}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      preserveAspectRatio="none"
    >
      {/* Drawn back to front so the nearest terrace paints last. */}
      {TERRACES.map((d, i) => (
        <path
          key={i}
          d={d}
          className={`terrace-${TERRACES.length - i}`}
          style={{ opacity: [0.6, 0.7, 0.8, 0.9][i] }}
        />
      )).reverse()}
    </svg>
  );
}
