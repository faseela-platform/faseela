import { MARK_VIEWBOX } from "@faseela/tokens/brand";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../lib/use-reduced-motion";
import { Mark } from "./mark";

/**
 * فسيلتك — the Member's own seedling (حسابي): the mark itself, revealed bottom-up
 * by lifetime progress toward the next رتبة. At zero progress the book and the
 * stem's base show (the journey grows out of the book); at the threshold the full
 * seedling stands. The mark is never redrawn or distorted — only clipped — so
 * ADR 0029 (logo 6a is the single mark) holds.
 *
 * Decorative: the numeric progress line beside it stays the accessible truth.
 */
const BASE = 0.42;

export function Seedling({
  fill,
  size = 120,
  night = false,
}: {
  /** 0..1 progress toward the next tier; 1 when the top tier is reached. */
  fill: number;
  size?: number;
  night?: boolean;
}) {
  const height = Math.round((size * MARK_VIEWBOX.height) / MARK_VIEWBOX.width);
  const reduced = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, fill));
  const target = Math.round(height * (BASE + (1 - BASE) * clamped));

  const revealed = useSharedValue(Math.round(height * BASE));
  useEffect(() => {
    if (reduced === null) return;
    revealed.value = reduced
      ? target
      : withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [target, reduced, revealed]);

  return (
    <View
      style={[styles.stage, { width: size, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.window, { height: revealed }]}>
        <View style={{ width: size, height }}>
          <Mark size={size} night={night} shadow={false} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: "center", justifyContent: "flex-end" },
  window: { overflow: "hidden", justifyContent: "flex-end" },
});
