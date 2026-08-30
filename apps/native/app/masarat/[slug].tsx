import type { MeResponse, TrackDetailResponse } from "@faseela/api-types";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { TaskItem } from "../../components/task-item";
import { useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function TrackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, retry } = useApi<TrackDetailResponse>(`/tracks/${slug}`);
  const styles = useThemeStyles(makeStyles);
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
            <Text style={styles.eyebrow}>مسار</Text>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.summary}>{data.summary}</Text>
            <View style={[styles.facts, row(isRTL)]}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>المهام</Text>
                <Text style={styles.factValue}>{arabicDigits(data.tasks.length)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>مجموع النقاط</Text>
                <Text style={[styles.factValue, styles.factGold]}>
                  {arabicDigits(data.totalPoints)}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.summary}>
              مهام هذا المسار قيد الإعداد. المسار منشور، وستُضاف مهامه قريباً.
            </Text>
          </View>
        }
        renderItem={({ item: task, index }) => (
          <TaskItem
            task={task}
            index={index}
            signedIn={signedIn}
            done={signedIn && completed.has(task.id)}
            isRTL={isRTL}
          />
        )}
      />
    </>
  );
}

const makeStyles = ({ colors }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    listContent: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
    header: { gap: space.sm, paddingBottom: space.sm },
    eyebrow: { ...text.captionStrong, color: colors.brand },
    title: { ...text.pageTitle, color: colors.ink },
    summary: { ...text.body, color: colors.inkMuted },
    facts: {
      gap: space.xl,
      marginTop: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      paddingTop: space.md,
    },
    fact: { gap: 2 },
    factLabel: { ...text.caption, color: colors.inkMuted },
    factValue: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 24,
      color: colors.ink,
      textAlign: "right",
    },
    factGold: { color: colors.accentInk },
    empty: { paddingVertical: space.xl, borderRadius: radius.card },
  });
