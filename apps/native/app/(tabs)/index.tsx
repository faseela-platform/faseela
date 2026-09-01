import type { ApiContentItem, FeedResponse } from "@faseela/api-types";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { FlatList, Image, Linking, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { WelcomeCard } from "../../components/welcome-card";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
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
 * opens its Track or its outbound link. Events carry gold, everything else teal — the
 * same rule as the web feed.
 */
export default function FeedScreen() {
  const { data, error, loading, retry } = useApi<FeedResponse>("/feed");
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <WelcomeCard />
        <EmptyView title="لا مستجدّات بعد" detail="سيظهر هنا جديد المبادرة عند نشره" />
      </View>
    );
  }

  function open(item: ApiContentItem) {
    if (item.trackSlug) router.push(`/masarat/${item.trackSlug}`);
    else if (item.linkUrl) Linking.openURL(item.linkUrl);
  }

  const teal = scheme === "dark" ? ["#35e2c2", "#14b899"] : ["#1ecfae", "#0e9b82"];
  const gold = scheme === "dark" ? ["#ecd08a", "#c7a958"] : ["#e3bd4e", "#b18f2f"];

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data.items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<WelcomeCard />}
      renderItem={({ item }) => {
        const isEvent = item.type === "event";
        const tappable = Boolean(item.trackSlug || item.linkUrl);
        return (
          <ScalePressable
            style={styles.card}
            onPress={() => open(item)}
            disabled={!tappable}
            accessibilityRole={tappable ? "button" : undefined}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={(isEvent ? gold : teal) as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.band}
              />
            )}
            <View style={styles.body}>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: isEvent ? colors.chipBg : colors.tintBrand },
                ]}
              >
                <Text
                  style={[styles.pillLabel, { color: isEvent ? colors.chipInk : colors.brand }]}
                >
                  {TYPE_LABEL[item.type] ?? item.type}
                  {item.trackTitle ? ` · ${item.trackTitle}` : ""}
                </Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text} numberOfLines={3}>
                {item.body}
              </Text>
              {isEvent && item.eventAt ? (
                <Text style={styles.meta}>
                  {dateTimeFmt.format(new Date(item.eventAt))}
                  {item.eventPlace ? ` — ${item.eventPlace}` : ""}
                </Text>
              ) : null}
              <Text style={styles.date}>{dateFmt.format(new Date(item.publishedAt))}</Text>
            </View>
          </ScalePressable>
        );
      }}
    />
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    content: { padding: space.lg, gap: space.lg, flexGrow: 1, paddingBottom: space.xxl },
    emptyWrap: { flex: 1, padding: space.lg, gap: space.lg, backgroundColor: colors.surface },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      overflow: "hidden",
      ...shadow(1),
    },
    image: { width: "100%", height: 160, backgroundColor: colors.chipBg },
    band: { height: 6 },
    body: { padding: space.lg, gap: space.xs },
    pill: {
      alignSelf: "flex-start",
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: 3,
      marginBottom: space.xs,
    },
    pillLabel: { ...text.captionStrong },
    title: { ...text.cardTitle, color: colors.ink },
    text: { ...text.body, color: colors.inkMuted },
    meta: { ...text.captionStrong, color: colors.accentInk, marginTop: space.xs },
    date: { ...text.caption, color: colors.inkMuted, marginTop: space.xs },
  });
