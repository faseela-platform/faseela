import {
  MARK_COLORS,
  MARK_GROUND,
  MARK_PATHS,
  MARK_STROKES,
  MARK_VIEWBOX,
} from "@faseela/tokens/brand";
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

/**
 * The mark (logo 6a) in the app — the same paths as the web `<Mark>`, drawn with
 * react-native-svg. Gradients are real here (the SVG engine handles them), so the app's
 * mark is the site's mark, not an approximation. `night` swaps to the night stops.
 */
export function Mark({
  size = 48,
  night = false,
  shadow = true,
}: {
  size?: number;
  night?: boolean;
  shadow?: boolean;
}) {
  const height = Math.round((size * MARK_VIEWBOX.height) / MARK_VIEWBOX.width);
  const c = MARK_COLORS;
  const tealHi = night ? c.tealHiNight : c.tealHi,
    tealLo = night ? c.tealLoNight : c.tealLo;
  const goldHi = night ? c.goldHiNight : c.goldHi,
    goldLo = night ? c.goldLoNight : c.goldLo;
  return (
    <Svg width={size} height={height} viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}>
      <Defs>
        <LinearGradient id="mt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tealHi} />
          <Stop offset="1" stopColor={tealLo} />
        </LinearGradient>
        <LinearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={goldHi} />
          <Stop offset="1" stopColor={goldLo} />
        </LinearGradient>
        <LinearGradient id="mp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.paperHi} />
          <Stop offset="1" stopColor={c.paperLo} />
        </LinearGradient>
        <RadialGradient id="mgr" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.shadow} stopOpacity={0.2} />
          <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {shadow ? (
        <Ellipse
          cx={MARK_GROUND.cx}
          cy={MARK_GROUND.cy}
          rx={MARK_GROUND.rx}
          ry={MARK_GROUND.ry}
          fill="url(#mgr)"
        />
      ) : null}
      <G>
        <Path d={MARK_PATHS.paperEdge} fill="url(#mp)" />
        <Path
          d={MARK_PATHS.paperLine}
          stroke={c.paperLine}
          strokeWidth={MARK_STROKES.paperLine}
          fill="none"
          opacity={0.9}
        />
        <Path d={MARK_PATHS.coverRight} fill="url(#mt)" />
        <Path d={MARK_PATHS.coverLeft} fill="url(#mt)" />
        <Path d={MARK_PATHS.sheenRight} fill="#ffffff" opacity={0.2} />
        <Path d={MARK_PATHS.sheenLeft} fill="#ffffff" opacity={0.2} />
        <Path
          d={MARK_PATHS.linesRight}
          stroke={c.pageLine}
          strokeWidth={MARK_STROKES.lines}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
        <Path
          d={MARK_PATHS.linesLeft}
          stroke={c.pageLine}
          strokeWidth={MARK_STROKES.lines}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
        <Path
          d={MARK_PATHS.stem}
          stroke="url(#mg)"
          strokeWidth={MARK_STROKES.stem}
          fill="none"
          strokeLinecap="round"
        />
        <Path d={MARK_PATHS.leafLower} fill="url(#mt)" />
        <Path d={MARK_PATHS.leafUpper} fill="url(#mt)" />
        <Path
          d={MARK_PATHS.veinLower}
          stroke={c.vein}
          strokeWidth={MARK_STROKES.vein}
          fill="none"
          strokeLinecap="round"
          opacity={0.95}
        />
        <Path
          d={MARK_PATHS.veinUpper}
          stroke={c.vein}
          strokeWidth={MARK_STROKES.vein}
          fill="none"
          strokeLinecap="round"
          opacity={0.95}
        />
      </G>
    </Svg>
  );
}
