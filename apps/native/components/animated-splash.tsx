import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";

import { useTheme } from "../lib/theme-context";
import { text } from "../lib/theme";

/**
 * The grow intro on launch — the app's branded moment (T1b, ADR 0028: no WebGL in the
 * app; the Lottie is the same choreography as the web intro, generated from the same
 * paths). Rendered over the app once the native splash has come down, then fades out.
 *
 * Reduced motion (the OS setting) shows the final frame and leaves at once. The
 * overlay never blocks longer than the animation plus a short hold — a Lottie that
 * failed to load must not become a splash that never ends, so a timer retires it
 * regardless.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { colors, scheme } = useTheme();
  const ref = useRef<LottieView>(null);
  /** Unknown until the OS answers; nothing plays until it has (no autoplay-then-jump). */
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => setReduced(false));
  }, []);

  useEffect(() => {
    if (reduced === null) return;
    const finish = () => setVisible(false);
    const id = setTimeout(finish, reduced ? 400 : 2400);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!visible) onDone();
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(350)}
      style={[styles.overlay, { backgroundColor: colors.surface }]}
      pointerEvents="none"
    >
      {reduced === null ? (
        <View style={styles.lottie} />
      ) : (
        <LottieView
          ref={ref}
          source={require("../assets/brand/grow.json")}
          autoPlay={!reduced}
          loop={false}
          progress={reduced ? 1 : undefined}
          style={styles.lottie}
          onAnimationFinish={() => setVisible(false)}
        />
      )}
      <Text
        style={[
          text.pageTitle,
          styles.wordmark,
          { color: scheme === "dark" ? "#ecd08a" : "#b18f2f" },
        ]}
      >
        فسيلـــة
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  lottie: { width: 220, height: 211 },
  wordmark: { marginTop: 4, textAlign: "center" },
});
