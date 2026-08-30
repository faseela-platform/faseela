import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";
import { Mark } from "./mark";
import { ScalePressable } from "./pressable";

/** Centered brand spinner — the one loading state every screen shares. */
export function LoadingView() {
  const { colors } = useTheme();
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

/** Localize from the machine code; the server's human message is never shown. */
function messageFor(code: string): string {
  return code === "not_found" ? "المحتوى غير موجود" : "تعذّر الاتصال";
}

export function ErrorView({ code, onRetry }: { code: string; onRetry: () => void }) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{messageFor(code)}</Text>
      <ScalePressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryLabel}>إعادة المحاولة</Text>
      </ScalePressable>
    </View>
  );
}

/** Designed absence, not an error — e.g. no season running. The mark keeps it company. */
export function EmptyView({ title, detail }: { title: string; detail?: string }) {
  const styles = useThemeStyles(makeStyles);
  const { scheme } = useTheme();
  return (
    <View style={styles.center}>
      <View style={styles.markWrap}>
        <Mark size={72} night={scheme === "dark"} shadow={false} />
      </View>
      <Text style={styles.message}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const makeStyles = ({ colors }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      padding: space.xl,
      gap: space.lg,
    },
    markWrap: { opacity: 0.55, marginBottom: space.sm },
    message: { ...text.section, color: colors.ink, textAlign: "center" },
    detail: { ...text.body, color: colors.inkMuted, textAlign: "center" },
    retry: {
      backgroundColor: colors.brand,
      borderRadius: radius.btn,
      paddingVertical: space.md,
      paddingHorizontal: space.xl,
      minHeight: 48,
      justifyContent: "center",
    },
    retryLabel: { ...text.bodyStrong, color: "#ffffff", textAlign: "center" },
  });
