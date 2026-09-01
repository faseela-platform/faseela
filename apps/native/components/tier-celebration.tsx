import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useReducedMotion } from "../lib/use-reduced-motion";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";

/**
 * The tier-up moment (§46 crossing a عتبة): the brand's own grow animation replayed
 * once, with the new رتبة named in gold — the reward is the seedling growing,
 * nothing foreign. Shown over حسابي when a focus refetch reports a higher tier than
 * the one on screen; a tap or a short timer retires it (never a modal that traps).
 * Reduced motion shows the final frame. The tier itself stays derived-on-read
 * (ADR 0024) — this is display, nothing is stored.
 */
export function TierCelebration({ tier, onDone }: { tier: string; onDone: () => void }) {
  const { colors, scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const reduced = useReducedMotion();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const id = setTimeout(onDone, 3600);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={styles.overlay}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="إغلاق التهنئة"
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
          {reduced === null ? (
            <View style={styles.lottie} />
          ) : (
            <LottieView
              source={require("../assets/brand/grow.json")}
              autoPlay={!reduced}
              loop={false}
              progress={reduced ? 1 : undefined}
              style={styles.lottie}
            />
          )}
          <Text style={styles.heading}>ارتقيت رتبة</Text>
          <Text style={[styles.tier, { color: scheme === "dark" ? "#ecd08a" : "#b18f2f" }]}>
            {tier}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = ({ colors }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 50,
    },
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 13, 0.45)",
      padding: space.xl,
    },
    card: {
      borderRadius: radius.card,
      paddingVertical: space.xl,
      paddingHorizontal: space.xxl,
      alignItems: "center",
      gap: space.xs,
    },
    heading: { ...text.body, color: colors.inkMuted },
    tier: { fontFamily: "Cairo_800ExtraBold", fontSize: 30 },
    lottie: { width: 160, height: 153 },
  });
