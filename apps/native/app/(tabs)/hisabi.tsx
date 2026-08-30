import type { MeResponse } from "@faseela/api-types";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { SignInForm } from "../../components/sign-in-form";
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
  const { preference, setPreference } = useTheme();
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
  const [lastUserId, setLastUserId] = useState(userId);
  if (lastUserId !== userId) {
    setLastUserId(userId);
    setState(meReducer(state, { type: "session", userId }));
  }

  /** Refetched on every focus (like the bell): an attest on a Track or a profile
   * completion changes the Points, tier and the «أكمِل حسابك» notice shown here. */
  const load = useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    authedFetch<MeResponse>("/me").then((r) => {
      if (cancelled) return;
      /** A stored token the server no longer honours: sign out locally, so the
       * sign-in form appears instead of a "connection" error that cannot be retried. */
      if (!r.ok && r.code === "unauthenticated") {
        void signOut();
        return;
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

          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(fill * 100)}%` }]} />
          </View>

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

      <ScalePressable style={styles.signOut} onPress={() => signOut()} accessibilityRole="button">
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </ScalePressable>
    </ScrollView>
  );
}

const makeStyles = ({ colors, shadow, scheme }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: { padding: space.lg, gap: space.lg, flexGrow: 1, paddingBottom: space.xxl },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(1),
    },
    cardGold: { backgroundColor: scheme === "dark" ? "#2a2617" : "#fbf6e6" },
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
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.hairline, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accentFill },
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
