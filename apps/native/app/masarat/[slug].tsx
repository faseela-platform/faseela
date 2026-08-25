import type { MeResponse, TrackDetailResponse } from "@faseela/api-types";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { TaskItem } from "../../components/task-item";
import { useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { arabicDigits, row } from "../../lib/rtl";
import { colors, radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function TrackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, retry } = useApi<TrackDetailResponse>(`/tracks/${slug}`);
  const isRTL = I18nManager.isRTL;

  const { data: session } = useSession();
  const signedIn = Boolean(session);
  /** The Member's completed Tasks, so an attest Task shows as done. Fetched when
   * signed in; signed-out is handled at render (`signedIn && …`), so the effect never
   * writes state synchronously. */
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    authedFetch<MeResponse>("/me").then((r) => {
      if (!cancelled && r.ok) setCompleted(new Set(r.data.completedTaskIds));
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

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
          <TaskItem
            task={task}
            signedIn={signedIn}
            done={signedIn && completed.has(task.id)}
            isRTL={isRTL}
          />
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
});
