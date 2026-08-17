import type { TracksResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { FlatList, I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { arabicDigits, row } from "../../lib/rtl";
import { colors, radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function TracksScreen() {
  const { data, error, loading, retry } = useApi<TracksResponse>("/tracks");
  const router = useRouter();
  const isRTL = I18nManager.isRTL;

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.tracks.length === 0) return <EmptyView title="لا توجد مسارات منشورة بعد" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data.tracks}
      keyExtractor={(track) => track.slug}
      renderItem={({ item: track }) => (
        <Pressable
          onPress={() => router.push({ pathname: "/masarat/[slug]", params: { slug: track.slug } })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.title}>{track.title}</Text>
          <Text style={styles.summary}>{track.summary}</Text>
          <View style={[styles.footer, row(isRTL)]}>
            <Text style={styles.meta}>
              {arabicDigits(track.taskCount)} مهام · {arabicDigits(track.totalPoints)} نقطة
            </Text>
          </View>
        </Pressable>
      )}
    />
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
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  title: {
    ...text.cardTitle,
    color: colors.ink,
  },
  summary: {
    ...text.body,
    color: colors.inkMuted,
  },
  footer: {
    marginTop: space.xs,
  },
  meta: {
    ...text.caption,
    color: colors.brand,
  },
});
