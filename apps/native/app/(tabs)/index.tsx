import type { ApiContentItem, FeedResponse, HomeZonesResponse } from "@faseela/api-types";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Linking, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { WelcomeCard } from "../../components/welcome-card";
import { useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
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

  /** Zones 2 and 5 (§3, R3): followed Tracks with their latest word, and اكتشف.
   * Refetched on focus, like the bell — a follow made on a Track screen shows here
   * the moment the Member comes back. Signed-out renders neither. */
  const { data: session } = useSession();
  const [zones, setZones] = useState<HomeZonesResponse | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setZones(null);
        return;
      }
      let cancelled = false;
      authedFetch<HomeZonesResponse>("/home").then((r) => {
        if (!cancelled && r.ok) setZones(r.data);
      });
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  const header = (
    <View style={styles.headerWrap}>
      <WelcomeCard />
      {zones && zones.followed.length > 0 ? (
        <View style={styles.zone}>
          <Text style={styles.zoneHeading}>مسارات تتابعها</Text>
          {zones.followed.map((f) => (
            <ScalePressable
              key={f.slug}
              style={styles.zoneCard}
              onPress={() => router.push(`/masarat/${f.slug}`)}
              accessibilityRole="button"
            >
              <Text style={styles.zoneTitle}>{f.title}</Text>
              <Text style={styles.zoneMeta}>
                {f.latest ? `جديدها: ${f.latest.title}` : "لا جديد بعد — مهامه بانتظارك"}
              </Text>
            </ScalePressable>
          ))}
        </View>
      ) : null}
      {zones && zones.discover.length > 0 ? (
        <View style={styles.zone}>
          <Text style={styles.zoneHeading}>اكتشف مسارات أخرى</Text>
          {zones.discover.map((d) => (
            <ScalePressable
              key={d.slug}
              style={styles.zoneCard}
              onPress={() => router.push(`/masarat/${d.slug}`)}
              accessibilityRole="button"
            >
              <Text style={styles.zoneTitle}>{d.title}</Text>
              <Text style={styles.zoneMeta} numberOfLines={2}>
                {d.summary}
              </Text>
            </ScalePressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {header}
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
      ListHeaderComponent={header}
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
    headerWrap: { gap: space.lg },
    zone: { gap: space.md },
    zoneHeading: { ...text.captionStrong, color: colors.brand },
    zoneCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.lg,
      gap: 2,
      ...shadow(1),
    },
    zoneTitle: { ...text.bodyStrong, color: colors.ink },
    zoneMeta: { ...text.caption, color: colors.inkMuted },
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
