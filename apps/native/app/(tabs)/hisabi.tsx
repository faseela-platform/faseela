import type { MeResponse } from "@faseela/api-types";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { Seedling } from "../../components/seedling";
import { SignInForm } from "../../components/sign-in-form";
import { TierCelebration } from "../../components/tier-celebration";
import { signOut, useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { INITIAL_ME_STATE, meReducer, type MeState } from "../../lib/me-state";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles, type Preference } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";

const PREFERENCES: { value: Preference; label: string }[] = [
  { value: "system", label: "تلقائي" },
  { value: "light", label: "نهاري" },
  { value: "dark", label: "ليلي" },
];

/**
 * The account tab (§3.1/§43): signed out, it hosts the OTP sign-in; signed in, it
 * shows the Member's standing from `/api/v1/me` — the tier in gold, the Points in
 * gold, a band bar to the next rung — and the appearance setting (owner D5: light by
 * default, night by choice, following the OS unless told otherwise).
 */
export default function AccountScreen() {
  const { data: session, isPending } = useSession();
  const { preference, setPreference, scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;
  const userId = session?.user.id ?? null;

  /**
   * `/me` lifecycle (`lib/me-state.ts`). The session event is applied adjust-during-
   * render so a sign-out clears the card in the same render the form appears, and a
   * different Member never sees the previous one's standing — no setState in an effect.
   */
  const [state, setState] = useState<MeState>(() =>
    meReducer(INITIAL_ME_STATE, { type: "session", userId }),
  );
  /** Set when a stored token the server no longer honours forced a local sign-out —
   * the one case where the sign-in form must explain itself (a mute swap reads as
   * "my خروج button vanished"). Cleared the moment a new session appears. */
  const [sessionExpired, setSessionExpired] = useState(false);

  /**
   * The tier last seen on this screen, for the tier-up moment: a focus refetch
   * reporting a higher رتبة than the one displayed earns the celebration. Keyed by
   * Member and written only inside the fetch callback (never during render — the
   * compiler forbids render-time ref writes), so a first load seeds it silently
   * (signing in is not a promotion) and another Member's stale entry cannot fire.
   */
  const lastTierRef = useRef<{ userId: string; tier: string } | null>(null);
  const [celebrateTier, setCelebrateTier] = useState<string | null>(null);
  const dismissCelebration = useCallback(() => setCelebrateTier(null), []);

  const [lastUserId, setLastUserId] = useState(userId);
  if (lastUserId !== userId) {
    setLastUserId(userId);
    setState(meReducer(state, { type: "session", userId }));
    if (userId) setSessionExpired(false);
    if (celebrateTier) setCelebrateTier(null);
  }

  /** Refetched on every focus (like the bell): an attest on a Track or a profile
   * completion changes the Points, tier and the «أكمِل حسابك» notice shown here. */
  const load = useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    authedFetch<MeResponse>("/me").then((r) => {
      if (cancelled) return;
      /** A stored token the server no longer honours: sign out locally, so the
       * sign-in form appears instead of a "connection" error that cannot be retried —
       * and say why, or the disappearance of خروج reads as a broken screen. */
      if (!r.ok && r.code === "unauthenticated") {
        setSessionExpired(true);
        void signOut();
        return;
      }
      if (r.ok) {
        const tier = r.data.progress.tier;
        const last = lastTierRef.current;
        if (last && last.userId === userId && last.tier !== tier) {
          setCelebrateTier(tier);
        }
        lastTierRef.current = { userId, tier };
      }
      setState((s) =>
        meReducer(s, r.ok ? { type: "loaded", me: r.data } : { type: "failed", code: r.code }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  useFocusEffect(load);
  const retry = useCallback(() => {
    setState((s) => meReducer(s, { type: "fetch" }));
    load();
  }, [load]);

  if (isPending) return <LoadingView />;

  const appearance = (
    <View style={styles.card}>
      <Text style={styles.label}>المظهر</Text>
      <View style={[styles.segments, row(isRTL)]}>
        {PREFERENCES.map((p) => {
          const on = preference === p.value;
          return (
            <ScalePressable
              key={p.value}
              onPress={() => setPreference(p.value)}
              style={[styles.segment, on && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{p.label}</Text>
            </ScalePressable>
          );
        })}
      </View>
    </View>
  );

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        {sessionExpired ? (
          <View style={styles.expiredCard} accessibilityRole="alert">
            <Text style={styles.expiredText}>انتهت جلستك، سجّل دخولك مجدداً.</Text>
          </View>
        ) : null}
        <SignInForm />
        {appearance}
      </ScrollView>
    );
  }

  const me = state.status === "signed-out" ? null : state.me;
  const fill =
    me && me.progress.nextTier && me.progress.pointsToNext !== null
      ? Math.min(
          1,
          Math.max(
            0,
            1 -
              me.progress.pointsToNext / Math.max(me.progress.pointsToNext + me.progress.points, 1),
          ),
        )
      : 1;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {!me ? (
          state.status === "error" ? (
            <ErrorView code={state.code} onRetry={retry} />
          ) : (
            <LoadingView />
          )
        ) : (
          <View style={[styles.card, styles.cardGold]}>
            <Text style={styles.name}>{me.user.name?.trim() || "حسابي"}</Text>

            {!me.profileComplete ? (
              <Text style={styles.notice}>
                أكمِل حسابك (الاسم ورقم الهاتف) لتُحتسب نقاطك عند إنجاز المهام.
              </Text>
            ) : null}

            <View style={[styles.tierRow, row(isRTL)]}>
              <View style={styles.tierPill}>
                <Text style={styles.tier}>{me.progress.tier}</Text>
              </View>
              <Text style={styles.points}>{arabicDigits(me.progress.points)} نقطة</Text>
            </View>

            {/** فسيلتك — the mark grows with the Member (replaces the flat bar; the
             * line below stays the accessible, numeric truth). */}
            <Seedling fill={fill} night={scheme === "dark"} />

            {me.progress.nextTier ? (
              <Text style={styles.muted}>
                {arabicDigits(me.progress.pointsToNext ?? 0)} نقطة حتى «{me.progress.nextTier}»
              </Text>
            ) : (
              <Text style={styles.muted}>بلغت أعلى رتبة. استمرّ في الإسهام.</Text>
            )}
          </View>
        )}

        {appearance}

        <ScalePressable
          style={styles.signOut}
          onPress={() =>
            /** One stray tap used to sign out instantly and silently — with no message
             * on the way back, that read as "I was signed in and then wasn't". */
            Alert.alert("تسجيل الخروج", "هل تريد الخروج من حسابك؟", [
              { text: "إلغاء", style: "cancel" },
              { text: "تسجيل الخروج", style: "destructive", onPress: () => void signOut() },
            ])
          }
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </ScalePressable>
      </ScrollView>

      {celebrateTier ? <TierCelebration tier={celebrateTier} onDone={dismissCelebration} /> : null}
    </View>
  );
}

const makeStyles = ({ colors, shadow, scheme }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: space.lg, gap: space.lg, flexGrow: 1, paddingBottom: space.xxl },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(1),
    },
    cardGold: { backgroundColor: scheme === "dark" ? "#2a2617" : "#fbf6e6" },
    expiredCard: {
      backgroundColor: scheme === "dark" ? "#2a2617" : "#fbf6e6",
      borderRadius: radius.card,
      padding: space.lg,
    },
    expiredText: { ...text.bodyStrong, color: colors.accentInk, textAlign: "center" },
    name: { ...text.pageTitle, color: colors.ink },
    notice: { ...text.body, color: colors.accentInk },
    tierRow: { alignItems: "center", justifyContent: "space-between" },
    tierPill: {
      backgroundColor: colors.chipBg,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    tier: { ...text.captionStrong, color: colors.chipInk },
    points: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 26,
      color: colors.accentInk,
      writingDirection: "rtl",
    },
    muted: { ...text.caption, color: colors.inkMuted },
    label: { ...text.captionStrong, color: colors.brand },
    segments: { gap: space.sm },
    segment: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.btn,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentOn: { borderColor: colors.brand, backgroundColor: colors.tintBrand },
    segmentLabel: { ...text.captionStrong, color: colors.inkMuted, textAlign: "center" },
    segmentLabelOn: { color: colors.brand },
    signOut: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.btn,
      paddingVertical: space.md,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    signOutText: { ...text.bodyStrong, color: colors.inkMuted },
  });
