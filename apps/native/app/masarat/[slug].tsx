import type {
  FollowResponse,
  MeResponse,
  TrackContentResponse,
  TrackDetailResponse,
} from "@faseela/api-types";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { RoadRail } from "../../components/road-rail";
import { TaskItem } from "../../components/task-item";
import { useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";
import { useApi } from "../../lib/use-fetch";

export default function TrackDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, retry } = useApi<TrackDetailResponse>(`/tracks/${slug}`);
  const { data: contentData } = useApi<TrackContentResponse>(`/tracks/${slug}/content`);
  const router = useRouter();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;

  const { data: session } = useSession();
  const signedIn = Boolean(session);
  /** The Member's completed Tasks, so an attest Task shows as done. Fetched when
   * signed in; signed-out is handled at render (`signedIn && …`), so the effect never
   * writes state synchronously. */
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  /** §10/§11: whether this Member follows the Track, and the public count. `null`
   * until `/me` answers, so the button never flashes the wrong verb. */
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  useEffect(() => {
    /** Signed out: the button is gated on `signedIn` at render, so no state to
     * clear here (a sync setState in an effect trips the compiler's cascade rule);
     * a later sign-in refetches and overwrites whatever is stale. */
    if (!session) return;
    let cancelled = false;
    authedFetch<MeResponse>("/me").then((r) => {
      if (cancelled || !r.ok) return;
      setCompleted(new Set(r.data.completedTaskIds));
      if (data) setFollowing(r.data.followedTrackIds.includes(data.trackId));
    });
    return () => {
      cancelled = true;
    };
  }, [session, data]);

  async function toggleFollow() {
    if (!data || following === null || followBusy) return;
    setFollowBusy(true);
    const r = await authedFetch<FollowResponse>("/follow", {
      method: following ? "DELETE" : "POST",
      body: { trackId: data.trackId },
    });
    setFollowBusy(false);
    if (r.ok) {
      setFollowing(r.data.following);
      setFollowerCount(r.data.followers);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView code={error ?? "malformed"} onRetry={retry} />;

  /** How far the road reads as walked: up to the furthest done Task (a road with
   * no gates measures arrival, not contiguity — same rule as the web). */
  const walked = data.tasks.reduce(
    (far, task, i) => (signedIn && completed.has(task.id) ? i + 1 : far),
    0,
  );

  return (
    <>
      <Stack.Screen options={{ title: data.title }} />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data.tasks}
        keyExtractor={(task) => task.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>مسار</Text>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.summary}>{data.summary}</Text>
            {/* §11: follow + the follower count. Signed-out readers see only the count. */}
            <View style={[styles.followRow, row(isRTL)]}>
              {signedIn && following !== null ? (
                <ScalePressable
                  style={[styles.followBtn, following && styles.followBtnOn]}
                  onPress={toggleFollow}
                  disabled={followBusy}
                  accessibilityRole="button"
                >
                  <Text style={[styles.followLabel, following && styles.followLabelOn]}>
                    {following ? "تتابع هذا المسار ✓" : "تابع المسار"}
                  </Text>
                </ScalePressable>
              ) : null}
              <Text style={styles.followCount}>
                {arabicDigits(followerCount ?? data.followerCount)}{" "}
                {(followerCount ?? data.followerCount) === 1 ? "متابع" : "متابعون"}
              </Text>
            </View>

            {/* §13: the Track's materials — tap one for its page and linked Tasks. */}
            {contentData && contentData.items.length > 0 ? (
              <View style={styles.contentStrip}>
                <Text style={styles.contentHeading}>المحتوى</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.contentRow, row(isRTL)]}>
                    {contentData.items.map((item) => (
                      <ScalePressable
                        key={item.id}
                        style={styles.contentCard}
                        onPress={() =>
                          router.push({ pathname: "/muhtawa/[id]", params: { id: item.id } })
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.contentTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.classification ? (
                          <Text style={styles.contentMeta}>{item.classification}</Text>
                        ) : null}
                      </ScalePressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View style={[styles.facts, row(isRTL)]}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>المهام</Text>
                <Text style={styles.factValue}>{arabicDigits(data.tasks.length)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>مجموع النقاط</Text>
                <Text style={[styles.factValue, styles.factGold]}>
                  {arabicDigits(data.totalPoints)}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.summary}>
              مهام هذا المسار قيد الإعداد. المسار منشور، وستُضاف مهامه قريباً.
            </Text>
          </View>
        }
        renderItem={({ item: task, index }) => (
          /** The rail rides beside every card; the row's own bottom padding keeps
           * the road continuous where a list gap would cut it. */
          <View style={[styles.taskRow, row(isRTL)]}>
            <RoadRail
              index={index}
              done={signedIn && completed.has(task.id)}
              walked={index < walked}
            />
            <View style={styles.taskCell}>
              <TaskItem
                task={task}
                index={index}
                signedIn={signedIn}
                done={signedIn && completed.has(task.id)}
                isRTL={isRTL}
              />
            </View>
          </View>
        )}
      />
    </>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: { backgroundColor: colors.surface },
    /** No list gap: the road must run unbroken, so spacing lives inside each row. */
    listContent: { padding: space.lg, paddingBottom: space.xxl },
    taskRow: { alignItems: "stretch" },
    taskCell: { flex: 1, paddingBottom: space.lg },
    header: { gap: space.sm, paddingBottom: space.lg },
    followRow: { alignItems: "center", gap: space.md, marginTop: space.xs },
    followBtn: {
      minHeight: 44,
      borderRadius: radius.btn,
      backgroundColor: colors.brand,
      paddingHorizontal: space.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    followBtnOn: {
      backgroundColor: colors.tintBrand,
      borderWidth: 1,
      borderColor: colors.brand,
    },
    followLabel: { ...text.bodyStrong, color: "#ffffff" },
    followLabelOn: { color: colors.brand },
    followCount: { ...text.caption, color: colors.inkMuted },
    contentStrip: { marginTop: space.sm, gap: space.sm },
    contentHeading: { ...text.captionStrong, color: colors.brand },
    contentRow: { gap: space.md },
    contentCard: {
      width: 180,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.lg,
      gap: space.xs,
      ...shadow(1),
    },
    contentTitle: { ...text.bodyStrong, color: colors.ink },
    contentMeta: { ...text.caption, color: colors.brand },
    eyebrow: { ...text.captionStrong, color: colors.brand },
    title: { ...text.pageTitle, color: colors.ink },
    summary: { ...text.body, color: colors.inkMuted },
    facts: {
      gap: space.xl,
      marginTop: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      paddingTop: space.md,
    },
    fact: { gap: 2 },
    factLabel: { ...text.caption, color: colors.inkMuted },
    factValue: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 24,
      color: colors.ink,
      textAlign: "right",
    },
    factGold: { color: colors.accentInk },
    empty: { paddingVertical: space.xl, borderRadius: radius.card },
  });
