import type { ContentDetailResponse } from "@faseela/api-types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { arabicDigits } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

/**
 * صفحة المحتوى (§14) on mobile — the piece, its Track, and the Tasks linked to it
 * (§15 path 1). Read-only: the work itself starts from the Track screen (attest
 * buttons, and «أرسل عملك» → muhimma/[id] for review Tasks), so each linked Task
 * routes to the Track.
 */
export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, retry } = useApi<ContentDetailResponse>(`/content/${id}`);
  const router = useRouter();
  const styles = useThemeStyles(makeStyles);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;

  return (
    <>
      <Stack.Screen options={{ title: data.title }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {data.imageUrl ? (
          <Image source={{ uri: data.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : null}
        {data.classification ? (
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>{data.classification}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{data.title}</Text>
        {data.trackTitle ? <Text style={styles.track}>{data.trackTitle}</Text> : null}
        <Text style={styles.body}>{data.body}</Text>

        {data.linkedTasks.length > 0 ? (
          <View style={styles.tasks}>
            <Text style={styles.tasksHeading}>المهام المرتبطة بهذا المحتوى</Text>
            {data.linkedTasks.map((task) => (
              <ScalePressable
                key={task.id}
                style={styles.taskCard}
                onPress={() =>
                  data.trackSlug &&
                  router.push({ pathname: "/masarat/[slug]", params: { slug: data.trackSlug } })
                }
                accessibilityRole="button"
              >
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{arabicDigits(task.points)} نقطة</Text>
              </ScalePressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.surface },
    content: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
    image: {
      width: "100%",
      height: 200,
      borderRadius: radius.card,
      backgroundColor: colors.chipBg,
      marginBottom: space.sm,
    },
    pill: {
      alignSelf: "flex-start",
      backgroundColor: colors.tintBrand,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: 3,
    },
    pillLabel: { ...text.captionStrong, color: colors.brand },
    title: { ...text.pageTitle, color: colors.ink },
    track: { ...text.captionStrong, color: colors.brand },
    body: { ...text.body, color: colors.inkMuted, marginTop: space.sm },
    tasks: { marginTop: space.xl, gap: space.md },
    tasksHeading: { ...text.captionStrong, color: colors.brand },
    taskCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.lg,
      gap: space.xs,
      ...shadow(1),
    },
    taskTitle: { ...text.bodyStrong, color: colors.ink },
    taskMeta: { ...text.captionStrong, color: colors.accentInk },
  });
