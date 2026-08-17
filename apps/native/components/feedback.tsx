import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, space, text } from "../lib/theme";

/** Centered brand spinner — the one loading state every screen shares. */
export function LoadingView() {
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
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{messageFor(code)}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <Text style={styles.retryLabel}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}

/** Designed absence, not an error — e.g. no season running. */
export function EmptyView({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: space.xl,
    gap: space.lg,
  },
  message: {
    ...text.section,
    color: colors.ink,
    textAlign: "center",
  },
  detail: {
    ...text.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  retry: {
    backgroundColor: colors.brand,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  retryPressed: {
    backgroundColor: colors.brandFill,
  },
  retryLabel: {
    ...text.bodyStrong,
    color: "#ffffff",
    textAlign: "center",
  },
});
