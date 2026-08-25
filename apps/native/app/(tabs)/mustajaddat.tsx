import type { ApiContentItem, FeedResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { FlatList, Image, Linking, Pressable, StyleSheet, Text } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { colors, radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

/** Arabic name of each content type (§33) — mobile-local so the feed reads cleanly. */
const TYPE_LABEL: Record<string, string> = {
  announcement: "إعلان",
  event: "فعالية",
  product: "إنتاج",
  news: "خبر",
  cultural: "مادة ثقافية",
  app_update: "تحديث التطبيق",
};

const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });
const dateTimeFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * المستجدّات — the content stream on mobile (§3). The visitor view of the home: one
 * merged, newest-first list of published content from `/api/v1/feed`. Tapping an item
 * opens its Track or its outbound link.
 */
export default function FeedScreen() {
  const { data, error, loading, retry } = useApi<FeedResponse>("/feed");
  const router = useRouter();

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.items.length === 0) {
    return <EmptyView title="لا مستجدّات بعد" detail="سيظهر هنا جديد المبادرة عند نشره" />;
  }

  function open(item: ApiContentItem) {
    if (item.trackSlug) router.push(`/masarat/${item.trackSlug}`);
    else if (item.linkUrl) Linking.openURL(item.linkUrl);
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => open(item)}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : null}
          <Text style={styles.kicker}>
            {TYPE_LABEL[item.type] ?? item.type}
            {item.trackTitle ? ` · ${item.trackTitle}` : ""}
          </Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={3}>
            {item.body}
          </Text>
          {item.type === "event" && item.eventAt ? (
            <Text style={styles.meta}>
              {dateTimeFmt.format(new Date(item.eventAt))}
              {item.eventPlace ? ` — ${item.eventPlace}` : ""}
            </Text>
          ) : null}
          <Text style={styles.date}>{dateFmt.format(new Date(item.publishedAt))}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.lg, flexGrow: 1 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.xs,
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: space.sm,
    backgroundColor: colors.chipBg,
  },
  kicker: { ...text.caption, color: colors.brand },
  title: { ...text.cardTitle, color: colors.ink },
  body: { ...text.body, color: colors.inkMuted },
  meta: { ...text.caption, color: colors.inkMuted, marginTop: space.xs },
  date: { ...text.caption, color: colors.inkMuted, marginTop: space.xs, opacity: 0.7 },
});
