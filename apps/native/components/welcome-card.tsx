import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "../lib/auth-client";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";
import { Mark } from "./mark";
import { ScalePressable } from "./pressable";

/**
 * The visitor welcome (§43): the app has no marketing landing — the install already
 * happened — so the feed's first card greets a signed-out visitor once and points at
 * sign-in. Dismissal persists on the device; a session hides it without dismissing,
 * so signing out later brings it back only if it was never dismissed.
 */
const DISMISSED_KEY = "faseela.welcome.dismissed";

export function WelcomeCard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);

  /** null = still reading the flag; render nothing rather than flash the card. */
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => {
        if (!cancelled) setDismissed(v === "1");
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isPending || session || dismissed !== false) return null;

  return (
    <View style={styles.card}>
      <View style={styles.markWrap}>
        <Mark size={56} night={scheme === "dark"} />
      </View>
      <Text style={styles.title}>أهلاً بك في فسيلة</Text>
      <Text style={styles.body}>
        اختر مساراً، أنجز مهامه، واجمع نقاطك — وسجّل دخولك ليُحتسب لك ما تنجزه.
      </Text>
      <ScalePressable
        style={styles.cta}
        onPress={() => router.push("/hisabi")}
        accessibilityRole="button"
      >
        <Text style={styles.ctaLabel}>سجّل دخولك</Text>
      </ScalePressable>
      <ScalePressable
        style={styles.later}
        onPress={() => {
          setDismissed(true);
          AsyncStorage.setItem(DISMISSED_KEY, "1").catch(() => {});
        }}
        accessibilityRole="button"
      >
        <Text style={styles.laterLabel}>لاحقاً</Text>
      </ScalePressable>
    </View>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.sm,
      alignItems: "center",
      ...shadow(1),
    },
    markWrap: { paddingVertical: space.xs },
    title: { ...text.pageTitle, color: colors.ink, textAlign: "center" },
    body: { ...text.body, color: colors.inkMuted, textAlign: "center" },
    cta: {
      marginTop: space.sm,
      minHeight: 48,
      alignSelf: "stretch",
      borderRadius: radius.btn,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaLabel: { ...text.bodyStrong, color: colors.surface },
    later: {
      minHeight: 44,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
    },
    laterLabel: { ...text.captionStrong, color: colors.inkMuted },
  });
