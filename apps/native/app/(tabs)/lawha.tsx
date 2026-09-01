import type { LeaderboardResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { useSession } from "../../lib/auth-client";
import { arabicDigits, row } from "../../lib/rtl";
import { seasonCountdownLabel, seasonDaysLeft } from "../../lib/season";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function LeaderboardScreen() {
  const { data, error, loading, retry } = useApi<LeaderboardResponse>("/leaderboard");
  const { data: session } = useSession();
  const router = useRouter();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.season === null) {
    return (
      <EmptyView
        title="لا يوجد موسم جارٍ حاليًا"
        detail="تبدأ اللوحة من جديد مع انطلاق الموسم القادم"
      />
    );
  }
  const season = data.season;
  const myId = session?.user?.id;
  /** The contest's clock (ADR 0024: a Season ends) — invisible until now. */
  const countdown = seasonCountdownLabel(seasonDaysLeft(season.endsAt, new Date()));

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data.rows}
      keyExtractor={(item) => item.userId}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>لوحة الموسم</Text>
          <Text style={styles.seasonTitle}>{season.title}</Text>
          <Text style={styles.lede}>الترتيب محسوب من النقاط المُحتسبة في هذا الموسم وحده.</Text>
          {countdown ? (
            <View style={styles.countdown}>
              <Text style={styles.countdownLabel}>{countdown}</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        /** Aligned with the web's framing: the Season is open, the Tasks are there,
         * and the first Member to complete one leads — an invitation, not a void. */
        <EmptyView
          title="لم تُحتسب نقاط في هذا الموسم بعد"
          detail="أول من يُنجز مهمة يتصدّر اللوحة"
        />
      }
      ListFooterComponent={
        /** A sparse board (a lonely row or two) reads as broken when it is simply a
         * Season at its start — say so and invite, same as the web. */
        data.rows.length < 5 ? (
          <View style={styles.invite}>
            {data.rows.length > 0 ? (
              <Text style={styles.inviteText}>اللوحة ما زالت في أولها — كن أول المتصدرين.</Text>
            ) : null}
            <ScalePressable
              style={styles.inviteButton}
              onPress={() => router.push("/masarat")}
              accessibilityRole="button"
            >
              <Text style={styles.inviteButtonLabel}>اختر مهمة</Text>
            </ScalePressable>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const top = item.rank <= 3;
        const me = myId === item.userId;
        return (
          <View style={[styles.row, me && styles.rowMe, row(isRTL)]}>
            <View style={[styles.rankBadge, top && styles.rankBadgeTop]}>
              <Text style={[styles.rank, top && styles.rankTop]}>{arabicDigits(item.rank)}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {item.name.trim() || "عضو"}
              {me ? <Text style={styles.me}> أنت</Text> : null}
            </Text>
            <Text style={styles.points}>{arabicDigits(item.points)} نقطة</Text>
          </View>
        );
      }}
    />
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    listContent: { padding: space.lg, gap: space.md, flexGrow: 1, paddingBottom: space.xxl },
    header: { paddingBottom: space.sm, gap: space.xs },
    countdown: {
      alignSelf: "flex-start",
      backgroundColor: colors.chipBg,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      marginTop: space.xs,
    },
    countdownLabel: { ...text.captionStrong, color: colors.chipInk },
    eyebrow: { ...text.captionStrong, color: colors.brand },
    seasonTitle: { ...text.pageTitle, color: colors.ink },
    lede: { ...text.body, color: colors.inkMuted },
    row: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      gap: space.md,
      minHeight: 56,
      ...shadow(1),
    },
    rowMe: { backgroundColor: colors.tintBrand },
    rankBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    rankBadgeTop: { backgroundColor: colors.chipBg },
    rank: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 16,
      color: colors.inkMuted,
      textAlign: "center",
    },
    rankTop: { color: colors.accentInk },
    name: { ...text.bodyStrong, color: colors.ink, flex: 1 },
    me: { ...text.captionStrong, color: colors.brand },
    points: { ...text.captionStrong, color: colors.accentInk },
    invite: {
      marginTop: space.sm,
      borderWidth: 1,
      borderColor: colors.hairline,
      borderRadius: radius.card,
      padding: space.lg,
      gap: space.md,
    },
    inviteText: { ...text.body, color: colors.inkMuted },
    inviteButton: {
      minHeight: 48,
      borderRadius: radius.btn,
      borderWidth: 1,
      borderColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    inviteButtonLabel: { ...text.bodyStrong, color: colors.brand },
  });
