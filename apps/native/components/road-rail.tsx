import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

import { useTheme } from "../lib/theme-context";

/**
 * طريق الفسائل v2 on mobile — the same earthen road as the web Track page
 * (owner round 2026-09-01: wide sand band, dashed centre, planting-circle
 * laybys, roadside flora), as per-item rail segments so the FlatList stays
 * virtualized. No `color-mix` in RN, so the sand pair is precomputed per
 * scheme from the same gold/surface families the web derives from.
 *
 * Decorative only — the card beside it carries all semantics.
 */
const SAND = {
  light: { bed: "#ece2c6", edge: "#dfd1a8", walked: "#ecd9a0" },
  dark: { bed: "#332d1e", edge: "#453c26", walked: "#4a4022" },
} as const;

type Plant = { kind: 0 | 1 | 2; top: number; left: number; size: number };

function plantsFor(index: number, count: number): Plant[] {
  const out: Plant[] = [];
  let h = (index + 1) * 2654435761;
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0xffffffff;
  };
  for (let i = 0; i < count; i++) {
    out.push({
      kind: (Math.floor(next() * 3) % 3) as 0 | 1 | 2,
      top: 5 + next() * 80,
      left: i % 2 === 0 ? next() * 8 : 54 + next() * 10,
      size: 12 + Math.round(next() * 10),
    });
  }
  return out;
}

function PlantGlyph({ plant, teal, deep }: { plant: Plant; teal: string; deep: string }) {
  const s = plant.size;
  if (plant.kind === 0) {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx={8} cy={14} r={6} fill={teal} />
        <Circle cx={16} cy={15} r={5} fill={deep} />
        <Circle cx={12} cy={9} r={5.5} fill={teal} />
      </Svg>
    );
  }
  if (plant.kind === 1) {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M12 22 C12 14 10 10 7 6"
          fill="none"
          stroke={teal}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M12 22 C12 13 12 9 12 4"
          fill="none"
          stroke={deep}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Path
          d="M12 22 C12 14 14 10 17 7"
          fill="none"
          stroke={teal}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Path
        d="M12 22 C12 16 12 12 12 8"
        fill="none"
        stroke={teal}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path d="M12 14 C9 12 6 13 5 16 C8 17 11 16 12 14 Z" fill={teal} />
      <Circle cx={12} cy={6.5} r={3} fill="#e3bd4e" />
    </Svg>
  );
}

export function RoadRail({
  index,
  done,
  walked,
}: {
  index: number;
  done: boolean;
  walked: boolean;
}) {
  const { colors, scheme } = useTheme();
  const sand = SAND[scheme === "dark" ? "dark" : "light"];
  const teal = colors.brand;
  const deep = scheme === "dark" ? "#0e9b82" : "#0c7a67";
  const apex = index % 2 === 0 ? 52 : 20;
  const d = `M36 0 C36 30 ${apex} 22 ${apex} 50 C${apex} 78 36 70 36 100`;
  const plants = plantsFor(index, 3);
  return (
    <View
      style={styles.rail}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 72 100" preserveAspectRatio="none">
        <Path
          d={d}
          fill="none"
          stroke={sand.edge}
          strokeWidth={30}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={d}
          fill="none"
          stroke={walked ? sand.walked : sand.bed}
          strokeWidth={25}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={d}
          fill="none"
          stroke={walked ? colors.accent : colors.surface}
          strokeWidth={walked ? 3 : 2.5}
          strokeDasharray={walked ? undefined : "8 7"}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>

      {plants.map((plant, i) => (
        <View key={i} style={{ position: "absolute", top: `${plant.top}%`, left: plant.left }}>
          <PlantGlyph plant={plant} teal={teal} deep={deep} />
        </View>
      ))}

      {/* The planting-circle layby with this Task's sprout. */}
      <View style={styles.layby}>
        <Svg width={48} height={48} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={29} fill={sand.edge} />
          <Circle cx={32} cy={32} r={25} fill={walked ? sand.walked : sand.bed} />
        </Svg>
        <View style={styles.sprout}>
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Ellipse cx={16} cy={26} rx={10} ry={3.5} fill={sand.edge} />
            {done ? (
              <>
                <Path
                  d="M16 26 C16 18 16 12 16 5"
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <Path d="M16 11 C20 6 25 6 27 10 C24 14 19 14 16 11 Z" fill={teal} />
                <Path d="M16 16 C12 11 7 11 5 15 C8 19 13 18 16 16 Z" fill={teal} />
              </>
            ) : (
              <Circle
                cx={16}
                cy={20}
                r={5.5}
                fill="none"
                stroke={colors.inkMuted}
                strokeWidth={2}
              />
            )}
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 72, alignSelf: "stretch" },
  layby: {
    position: "absolute",
    top: "50%",
    left: 12,
    marginTop: -24,
  },
  sprout: {
    position: "absolute",
    top: 8,
    left: 8,
  },
});
