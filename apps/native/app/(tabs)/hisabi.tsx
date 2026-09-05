import type { MeResponse, WorkRecordResponse } from "@faseela/api-types";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorView, LoadingView } from "../../components/feedback";
import { ScalePressable } from "../../components/pressable";
import { Seedling } from "../../components/seedling";
import { SignInForm } from "../../components/sign-in-form";
import { TierCelebration } from "../../components/tier-celebration";
import { signOut, useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { INITIAL_ME_STATE, meReducer, type MeState } from "../../lib/me-state";
import { arabicDigits, row } from "../../lib/rtl";
import { useTheme, useThemeStyles } from "../../lib/theme-context";
import { radius, space, text } from "../../lib/theme";

const OPEN_LABEL: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  returned: "أُعيد للتحسين",
  rejected: "لم يُقبل",
  cancelled: "مسودة مغلقة",
};

/**
 * The account tab (§3.1/§43): signed out, it hosts the OTP sign-in; signed in, it
 * shows the Member's standing from `/api/v1/me` — the tier in gold, the Points in
 * gold, the seedling to the next rung — and سجل أعمالي. One role: "who I am"
 * (ADR 0036). المظهر and تسجيل الخروج moved to الإعدادات (owner, 2026-09-05),
 * reached from the row at the foot of this screen.
 */
export default function AccountScreen() {
  const { data: session, isPending } = useSession();
  const { scheme } = useTheme();
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

  /** سجل أعمالي (§30 addition): refetched on focus with /me, same lifecycle. */
  const [record, setRecord] = useState<WorkRecordResponse | null>(null);

  const [lastUserId, setLastUserId] = useState(userId);
  if (lastUserId !== userId) {
    setLastUserId(userId);
    setState(meReducer(state, { type: "session", userId }));
    if (userId) setSessionExpired(false);
    if (celebrateTier) setCelebrateTier(null);
    setRecord(null);
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
    authedFetch<WorkRecordResponse>("/record").then((r) => {
      if (!cancelled && r.ok) setRecord(r.data);
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

  /** The door to المظهر، تعديل البيانات، تسجيل الخروج — and where خروج went, so the
   * row must exist signed out too (a Member looking for it must find this, not a gap). */
  const settingsRow = (
    <ScalePressable
      style={styles.settingsRow}
      onPress={() => router.push("/iadadat")}
      accessibilityRole="button"
    >
      <Text style={styles.settingsText}>الإعدادات</Text>
      <Text style={styles.settingsHint}>المظهر · بياناتي · تسجيل الخروج</Text>
    </ScalePressable>
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
        {settingsRow}
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

        {/* سجل أعمالي (§30 addition, R3): completed work from the ledger, and open
         * submissions with their true states — the Member's own record, no one else's. */}
        {record && (record.completed.length > 0 || record.submissions.length > 0) ? (
          <View style={styles.card}>
            <Text style={styles.label}>سجل أعمالي</Text>
            {record.submissions.length > 0 ? (
              <View style={styles.recordGroup}>
                {record.submissions.map((w, i) => (
                  <View key={`s-${i}`} style={[styles.recordRow, row(isRTL)]}>
                    <View style={styles.recordMain}>
                      <Text style={styles.recordTitle} numberOfLines={1}>
                        {w.taskTitle}
                      </Text>
                      <Text style={styles.recordMeta}>{w.trackTitle}</Text>
                    </View>
                    <View style={styles.recordPill}>
                      <Text style={styles.recordPillLabel}>{OPEN_LABEL[w.state] ?? w.state}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {record.completed.map((w, i) => (
              <View key={`c-${i}`} style={[styles.recordRow, row(isRTL)]}>
                <View style={styles.recordMain}>
                  <Text style={styles.recordTitle} numberOfLines={1}>
                    {w.taskTitle}
                  </Text>
                  <Text style={styles.recordMeta}>{w.trackTitle}</Text>
                </View>
                <Text style={styles.recordPoints}>+{arabicDigits(w.points)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {settingsRow}
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
    recordGroup: { gap: 0 },
    recordRow: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
      paddingVertical: space.sm,
      minHeight: 44,
    },
    recordMain: { flex: 1, minWidth: 0 },
    recordTitle: { ...text.bodyStrong, color: colors.ink },
    recordMeta: { ...text.caption, color: colors.inkMuted },
    recordPill: {
      backgroundColor: colors.tintBrand,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: 3,
    },
    recordPillLabel: { ...text.captionStrong, color: colors.brand },
    recordPoints: { ...text.captionStrong, color: colors.accentInk },
    settingsRow: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.btn,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      minHeight: 56,
      justifyContent: "center",
      gap: 2,
      backgroundColor: colors.surfaceRaised,
    },
    settingsText: { ...text.bodyStrong, color: colors.ink },
    settingsHint: { ...text.caption, color: colors.inkMuted },
  });
