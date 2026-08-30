import type { LeaderboardResponse } from "@faseela/api-types";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { useSession } from "../../lib/auth-client";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function LeaderboardScreen() {
  const { data, error, loading, retry } = useApi<LeaderboardResponse>("/leaderboard");
  const { data: session } = useSession();
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
        </View>
      }
      ListEmptyComponent={
        <EmptyView title="لا نقاط بعد" detail="أكمِل مهمة من أحد المسارات لتظهر هنا" />
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
  });
