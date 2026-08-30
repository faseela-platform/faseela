import type { TracksResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { FlatList, I18nManager, StyleSheet, Text, View } from "react-native";

import { EmptyView, ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function TracksScreen() {
  const { data, error, loading, retry } = useApi<TracksResponse>("/tracks");
  const router = useRouter();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;
  if (data.tracks.length === 0)
    return <EmptyView title="لا توجد مسارات منشورة بعد" detail="عُد قريباً — أول مسار في طريقه" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={data.tracks}
      keyExtractor={(track) => track.slug}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>المسارات</Text>
          <Text style={styles.heading}>اختر مسارك وابدأ</Text>
        </View>
      }
      renderItem={({ item: track, index }) => (
        <ScalePressable
          onPress={() => router.push({ pathname: "/masarat/[slug]", params: { slug: track.slug } })}
          style={styles.card}
          accessibilityRole="button"
        >
          <Text style={styles.ordinal}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={styles.title}>{track.title}</Text>
          <Text style={styles.summary}>{track.summary}</Text>
          <View style={[styles.footer, row(isRTL)]}>
            <Text style={styles.meta}>{arabicDigits(track.taskCount)} مهام</Text>
            <Text style={styles.points}>{arabicDigits(track.totalPoints)} نقطة</Text>
          </View>
        </ScalePressable>
      )}
    />
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    listContent: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
    header: { gap: space.xs, paddingBottom: space.sm },
    eyebrow: { ...text.captionStrong, color: colors.brand },
    heading: { ...text.pageTitle, color: colors.ink },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.sm,
      ...shadow(1),
    },
    ordinal: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 22,
      color: colors.accent,
      writingDirection: "ltr",
      textAlign: "right",
    },
    title: { ...text.cardTitle, color: colors.ink },
    summary: { ...text.body, color: colors.inkMuted },
    footer: {
      marginTop: space.xs,
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      paddingTop: space.sm,
    },
    meta: { ...text.caption, color: colors.inkMuted },
    points: { ...text.captionStrong, color: colors.accentInk },
  });
