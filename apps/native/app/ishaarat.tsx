import type { ApiNotification, NotificationsResponse } from "@faseela/api-types";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, I18nManager, Linking, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../components/feedback";
import { ScalePressable } from "../components/pressable";
import { useSession } from "../lib/auth-client";
import { authedFetch } from "../lib/authed-api";
import { row } from "../lib/rtl";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";

/**
 * الإشعارات on the phone (§38) — the same bell as the web, reading the same rows.
 *
 * Refetched on focus rather than subscribed to: the pooled connection has no
 * LISTEN/NOTIFY, and a Member who opens this screen is exactly when the answer needs
 * to be fresh. Opening it also marks everything read, which is what §3's "don't show
 * it again" asks for.
 */
const KIND: Record<string, { label: string; tone: "brand" | "gold" | "muted" }> = {
  submission_accepted: { label: "قُبل", tone: "brand" },
  submission_returned: { label: "للتحسين", tone: "gold" },
  submission_rejected: { label: "لم يُقبل", tone: "muted" },
  points_awarded: { label: "نقاط", tone: "gold" },
  tier_unlocked: { label: "رتبة", tone: "gold" },
  track_update: { label: "مسار", tone: "brand" },
  app_update: { label: "تحديث", tone: "muted" },
  announcement: { label: "إعلان", tone: "brand" },
};

const dateFmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;
  const { data: session } = useSession();
  const [state, setState] = useState<{
    items: ApiNotification[] | null;
    error: string | null;
    loading: boolean;
  }>({ items: null, error: null, loading: true });
  /** Bumped by the retry button so the fetch effect runs again. */
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      /** Read so the dependency is real: bumping `attempt` is what re-runs this. */
      void attempt;
      let cancelled = false;
      authedFetch<NotificationsResponse>("/notifications").then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setState({ items: r.data.items, error: null, loading: false });
          /** Reading the list is what marks it read — fire and forget. */
          void authedFetch("/notifications/seen", { method: "POST" });
        } else {
          setState({ items: null, error: r.code, loading: false });
        }
      });
      return () => {
        cancelled = true;
      };
    }, [session, attempt]),
  );

  if (!session) {
    return <EmptyView title="سجّل دخولك" detail="افتح تبويب «حسابي» لتصلك إشعاراتك" />;
  }
  if (state.loading) return <LoadingView />;
  if (state.error || !state.items) {
    return (
      <ErrorView
        code={state.error ?? "malformed"}
        onRetry={() => {
          setState({ items: null, error: null, loading: true });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (state.items.length === 0) {
    return <EmptyView title="لا إشعارات بعد" detail="سيصلك هنا خبر قبول عملك واحتساب نقاطك" />;
  }

  const toneColors = {
    brand: { bg: colors.tintBrand, ink: colors.brand },
    gold: { bg: colors.chipBg, ink: colors.chipInk },
    muted: { bg: colors.hairline, ink: colors.inkMuted },
  } as const;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={state.items}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => {
        const kind = KIND[item.type] ?? { label: "إشعار", tone: "muted" as const };
        const tone = toneColors[kind.tone];

        const card = (
          <View style={[styles.card, !item.seen && styles.unread]}>
            <View style={[styles.head, row(isRTL)]}>
              <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.kind, { color: tone.ink }]}>{kind.label}</Text>
              </View>
              <Text style={styles.when}>{dateFmt.format(new Date(item.publishedAt))}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        );

        /**
         * A Track goes through the router — it is a screen in this app. An outbound
         * link leaves for the browser. Anything else is not tappable, which is honest:
         * a card that highlights under the finger and then does nothing is worse than
         * one that plainly does not move.
         */
        if (item.trackSlug) {
          return (
            <ScalePressable
              onPress={() => router.push(`/masarat/${item.trackSlug}`)}
              accessibilityRole="button"
            >
              {card}
            </ScalePressable>
          );
        }
        if (item.linkUrl) {
          const url = item.linkUrl;
          return (
            <ScalePressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
              {card}
            </ScalePressable>
          );
        }
        return card;
      }}
    />
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    content: { padding: space.lg, gap: space.md, flexGrow: 1, paddingBottom: space.xxl },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.lg,
      gap: space.xs,
      ...shadow(1),
    },
    /* Unread = the teal tint, the same surface rule as the web. */
    unread: { backgroundColor: colors.tintBrand },
    head: { justifyContent: "space-between", alignItems: "center", marginBottom: space.xs },
    pill: { borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: 3 },
    kind: { ...text.captionStrong },
    when: { ...text.caption, color: colors.inkMuted },
    title: { ...text.bodyStrong, color: colors.ink },
    body: { ...text.body, color: colors.inkMuted },
  });
