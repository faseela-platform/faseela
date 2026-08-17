import type { TrackDetailResponse } from "@faseela/api-types";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { arabicDigits, row } from "../../lib/rtl";
import { colors, radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

const MODE_LABEL = { attest: "حضور/تصديق", review: "مراجعة" } as const;

export default function TrackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, retry } = useApi<TrackDetailResponse>(`/tracks/${slug}`);
  const isRTL = I18nManager.isRTL;

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;

  return (
    <>
      <Stack.Screen options={{ title: data.title }} />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data.tasks}
        keyExtractor={(task) => task.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.summary}>{data.summary}</Text>
            <View style={[styles.chipRow, row(isRTL)]}>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>{arabicDigits(data.totalPoints)} نقطة</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: task }) => (
          <View style={styles.card}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.instructions}>{task.instructions}</Text>
            <View style={[styles.taskFooter, row(isRTL)]}>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>{arabicDigits(task.points)} نقطة</Text>
              </View>
              <Text style={styles.mode}>{MODE_LABEL[task.mode]}</Text>
            </View>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
  },
  listContent: {
    padding: space.lg,
    gap: space.lg,
  },
  header: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  title: {
    ...text.pageTitle,
    color: colors.ink,
  },
  summary: {
    ...text.body,
    color: colors.inkMuted,
  },
  chipRow: {
    marginTop: space.xs,
  },
  chip: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.chip,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    alignSelf: "flex-start",
  },
  chipLabel: {
    ...text.caption,
    color: colors.chipInk,
  },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.sm,
  },
  taskTitle: {
    ...text.cardTitle,
    color: colors.ink,
  },
  instructions: {
    ...text.body,
    color: colors.inkMuted,
  },
  taskFooter: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xs,
  },
  mode: {
    ...text.caption,
    color: colors.inkMuted,
  },
});
