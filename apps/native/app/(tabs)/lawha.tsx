import type { LeaderboardResponse } from "@faseela/api-types";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { arabicDigits, row } from "../../lib/rtl";
import { colors, radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function LeaderboardScreen() {
  const { data, error, loading, retry } = useApi<LeaderboardResponse>("/leaderboard");
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

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data.rows}
      keyExtractor={(item) => item.userId}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.seasonTitle}>{season.title}</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyView title="لا نقاط بعد" detail="أكمِل مهمة من أحد المسارات لتظهر هنا" />
      }
      renderItem={({ item }) => (
        <View style={[styles.row, row(isRTL)]}>
          <View style={styles.rankBadge}>
            <Text style={[styles.rank, item.rank <= 3 && styles.rankTop]}>
              {arabicDigits(item.rank)}
            </Text>
          </View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.points}>{arabicDigits(item.points)} نقطة</Text>
        </View>
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
    gap: space.md,
    flexGrow: 1,
  },
  header: {
    paddingBottom: space.sm,
  },
  seasonTitle: {
    ...text.pageTitle,
    color: colors.ink,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  rankBadge: {
    width: 36,
    alignItems: "center",
  },
  rank: {
    ...text.bodyStrong,
    color: colors.inkMuted,
    textAlign: "center",
  },
  rankTop: {
    color: colors.accent,
  },
  name: {
    ...text.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  points: {
    ...text.caption,
    color: colors.brand,
  },
});
