/**
 * The mark as an SVG string, for the render scripts. Mirrors `apps/web/app/(site)/components/mark.tsx`
 * layer for layer (the same `data-layer` groups, the same stem `pathLength`), so the grow keyframes in
 * `apps/web/app/landing.css` drive both the site and the exports.
 */
import {
  MARK_COLORS,
  MARK_GROUND,
  MARK_PATHS,
  MARK_STROKES,
  MARK_VIEWBOX,
} from "../../packages/tokens/brand.ts";

export const PAPER = "#f7fbfa";

/** `mono` = single colour; `shadow` = ground + soft shadow; `grow` = carries the `.mark-grow` class. */
export function markSvg({
  size,
  mono = false,
  shadow = true,
  color = "#0b0e0d",
  grow = false,
  idPrefix = "m",
}) {
  const h = Math.round((size * MARK_VIEWBOX.height) / MARK_VIEWBOX.width);
  const id = (n) => `${idPrefix}-${n}`;
  const teal = mono ? color : `url(#${id("t")})`;
  const gold = mono ? color : `url(#${id("g")})`;
  const P = MARK_PATHS,
    S = MARK_STROKES,
    C = MARK_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}" width="${size}" height="${h}" class="${grow ? "mark-grow" : ""}" style="overflow: visible; display: block;">
  ${
    mono
      ? ""
      : `<defs>
    <linearGradient id="${id("t")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.tealHi}"/><stop offset="1" stop-color="${C.tealLo}"/></linearGradient>
    <linearGradient id="${id("g")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.goldHi}"/><stop offset="1" stop-color="${C.goldLo}"/></linearGradient>
    <linearGradient id="${id("p")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.paperHi}"/><stop offset="1" stop-color="${C.paperLo}"/></linearGradient>
    <radialGradient id="${id("gr")}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.shadow}" stop-opacity="0.2"/><stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/></radialGradient>
    <filter id="${id("s")}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="${C.glow}" flood-opacity="0.22"/></filter>
  </defs>`
  }
  ${shadow && !mono ? `<g data-layer="shadow"><ellipse cx="${MARK_GROUND.cx}" cy="${MARK_GROUND.cy}" rx="${MARK_GROUND.rx}" ry="${MARK_GROUND.ry}" fill="url(#${id("gr")})"/></g>` : ""}
  <g ${shadow && !mono ? `filter="url(#${id("s")})"` : ""}>
    <g data-layer="paper">
      <path d="${P.paperEdge}" fill="${mono ? color : `url(#${id("p")})`}" ${mono ? 'opacity="0.55"' : ""}/>
      ${mono ? "" : `<path d="${P.paperLine}" stroke="${C.paperLine}" stroke-width="${S.paperLine}" fill="none" opacity="0.9"/>`}
    </g>
    <g data-layer="covers">
      <path d="${P.coverRight}" fill="${teal}"/><path d="${P.coverLeft}" fill="${teal}"/>
      ${mono ? "" : `<path d="${P.sheenRight}" fill="#fff" opacity="0.2"/><path d="${P.sheenLeft}" fill="#fff" opacity="0.2"/>`}
    </g>
    <g data-layer="lines">
      <path d="${P.linesRight}" stroke="${mono ? PAPER : C.pageLine}" stroke-width="${S.lines}" fill="none" stroke-linecap="round" opacity="0.7"/>
      <path d="${P.linesLeft}" stroke="${mono ? PAPER : C.pageLine}" stroke-width="${S.lines}" fill="none" stroke-linecap="round" opacity="0.7"/>
    </g>
    <g data-layer="stem"><path d="${P.stem}" pathLength="1" stroke="${gold}" stroke-width="${S.stem}" fill="none" stroke-linecap="round"/></g>
    <g data-layer="leaves"><path d="${P.leafLower}" fill="${teal}"/><path d="${P.leafUpper}" fill="${teal}"/></g>
    ${mono ? "" : `<g data-layer="veins"><path d="${P.veinLower}" stroke="${C.vein}" stroke-width="${S.vein}" fill="none" stroke-linecap="round" opacity="0.95"/><path d="${P.veinUpper}" stroke="${C.vein}" stroke-width="${S.vein}" fill="none" stroke-linecap="round" opacity="0.95"/></g>`}
  </g>
</svg>`;
}
