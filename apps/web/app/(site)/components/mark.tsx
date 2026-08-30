import {
  MARK_COLORS,
  MARK_GROUND,
  MARK_PATHS,
  MARK_STROKES,
  MARK_VIEWBOX,
} from "@faseela/tokens/brand";

/**
 * The Faseela mark (logo 6a) as inline SVG — ADR 0029.
 *
 * Server-safe: no hooks, no client boundary, so it can sit in the static landing and
 * in every metadata route. Geometry comes from `@faseela/tokens/brand`, never from a
 * copy here.
 *
 * Two things are deliberate:
 *
 * - Every part is its own `<g data-layer>` so the CSS-3D hero can lift layers to
 *   different depths and the grow intro (T1b) can animate the stem and leaves
 *   individually. Flattening them would make both impossible.
 * - `idPrefix` namespaces the gradient/filter ids. Several marks share a page (nav,
 *   hero, empty states), and duplicate SVG ids make every later one paint with the
 *   first one's gradients — or, in `mono`, nothing at all. `useId` would do this but
 *   turns the component into a client-hook consumer; a prop keeps it server-safe.
 *
 * `mono` draws the whole mark in `currentColor` — for favicons at small sizes,
 * Android's monochrome icon, stamps and loading states — where gradients would only
 * smear.
 */
export function Mark({
  size = 48,
  mono = false,
  shadow = true,
  grow = false,
  idPrefix = "mark",
  title,
  className,
}: {
  /**
   * Play the grow intro (T1b): the stem draws upward, the leaves unfurl, the covers settle.
   * CSS-only, once per session (`theme-script.tsx` stamps `data-grown` on <html>), final
   * frame under reduced motion. Only the hero's front layer asks for it.
   */
  grow?: boolean;
  /** Rendered width in px; height follows the 240:230 viewBox. */
  size?: number;
  /** Single-colour rendering in `currentColor`. */
  mono?: boolean;
  /** The ground ellipse and soft drop shadow. Off for icons and the 3D layers. */
  shadow?: boolean;
  /** Namespace for the gradient ids — unique per instance on a page. */
  idPrefix?: string;
  /** Accessible name. Omit to mark the SVG decorative (`aria-hidden`). */
  title?: string;
  className?: string;
}) {
  const height = Math.round((size * MARK_VIEWBOX.height) / MARK_VIEWBOX.width);
  const teal = `url(#${idPrefix}-teal)`;
  const gold = `url(#${idPrefix}-gold)`;
  const paper = `url(#${idPrefix}-paper)`;
  const fillTeal = mono ? "currentColor" : teal;
  const fillGold = mono ? "currentColor" : gold;

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      width={size}
      height={height}
      className={`${grow ? "mark-grow" : ""}${className ?? ""}`.trim() || undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ overflow: "visible" }}
    >
      {!mono ? (
        <defs>
          {/* Token roles first (T2 defines them); the mark's own colours as the fallback. */}
          <linearGradient id={`${idPrefix}-teal`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `var(--teal-hi, ${MARK_COLORS.tealHi})` }} />
            <stop offset="1" style={{ stopColor: `var(--teal-lo, ${MARK_COLORS.tealLo})` }} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `var(--gold-hi, ${MARK_COLORS.goldHi})` }} />
            <stop offset="1" style={{ stopColor: `var(--gold-lo, ${MARK_COLORS.goldLo})` }} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-paper`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={MARK_COLORS.paperHi} />
            <stop offset="1" stopColor={MARK_COLORS.paperLo} />
          </linearGradient>
          <radialGradient id={`${idPrefix}-ground`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={MARK_COLORS.shadow} stopOpacity="0.2" />
            <stop offset="1" stopColor={MARK_COLORS.shadow} stopOpacity="0" />
          </radialGradient>
          <filter id={`${idPrefix}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="8"
              floodColor={MARK_COLORS.glow}
              floodOpacity="0.22"
            />
          </filter>
        </defs>
      ) : null}

      {shadow && !mono ? (
        <g data-layer="shadow">
          <ellipse
            cx={MARK_GROUND.cx}
            cy={MARK_GROUND.cy}
            rx={MARK_GROUND.rx}
            ry={MARK_GROUND.ry}
            fill={`url(#${idPrefix}-ground)`}
          />
        </g>
      ) : null}

      <g filter={shadow && !mono ? `url(#${idPrefix}-soft)` : undefined}>
        <g data-layer="paper">
          <path
            d={MARK_PATHS.paperEdge}
            fill={mono ? "currentColor" : paper}
            opacity={mono ? 0.55 : 1}
          />
          {!mono ? (
            <path
              d={MARK_PATHS.paperLine}
              stroke={MARK_COLORS.paperLine}
              strokeWidth={MARK_STROKES.paperLine}
              fill="none"
              opacity="0.9"
            />
          ) : null}
        </g>

        <g data-layer="covers">
          <path d={MARK_PATHS.coverRight} fill={fillTeal} />
          <path d={MARK_PATHS.coverLeft} fill={fillTeal} />
          {!mono ? (
            <>
              <path d={MARK_PATHS.sheenRight} fill="#ffffff" opacity="0.2" />
              <path d={MARK_PATHS.sheenLeft} fill="#ffffff" opacity="0.2" />
            </>
          ) : null}
        </g>

        <g data-layer="lines">
          <path
            d={MARK_PATHS.linesRight}
            stroke={mono ? "var(--surface, #f7fbfa)" : MARK_COLORS.pageLine}
            strokeWidth={MARK_STROKES.lines}
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d={MARK_PATHS.linesLeft}
            stroke={mono ? "var(--surface, #f7fbfa)" : MARK_COLORS.pageLine}
            strokeWidth={MARK_STROKES.lines}
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>

        <g data-layer="stem">
          {/* pathLength=1 so the grow intro can draw it with a unit dash, whatever its true length. */}
          <path
            d={MARK_PATHS.stem}
            pathLength={1}
            stroke={fillGold}
            strokeWidth={MARK_STROKES.stem}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        <g data-layer="leaves">
          <path d={MARK_PATHS.leafLower} fill={fillTeal} />
          <path d={MARK_PATHS.leafUpper} fill={fillTeal} />
        </g>

        {!mono ? (
          <g data-layer="veins">
            <path
              d={MARK_PATHS.veinLower}
              stroke={MARK_COLORS.vein}
              strokeWidth={MARK_STROKES.vein}
              fill="none"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d={MARK_PATHS.veinUpper}
              stroke={MARK_COLORS.vein}
              strokeWidth={MARK_STROKES.vein}
              fill="none"
              strokeLinecap="round"
              opacity="0.95"
            />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
