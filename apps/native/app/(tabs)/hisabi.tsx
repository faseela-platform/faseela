import type { MeResponse } from "@faseela/api-types";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LoadingView } from "../../components/feedback";
import { SignInForm } from "../../components/sign-in-form";
import { signOut, useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { arabicDigits } from "../../lib/rtl";
import { colors, radius, space, text } from "../../lib/theme";

/**
 * The account tab (§3.1/§43): signed out, it hosts the OTP sign-in; signed in, it
 * shows the Member's standing from `/api/v1/me`. This is where the mobile auth flow
 * is proven end-to-end — the runtime the `@better-auth/expo` cast defers to.
 */
export default function AccountScreen() {
  const { data: session, isPending } = useSession();
  /** Loaded when signed in; signed-out short-circuits to the sign-in form before `me`
   * is read, so the effect never writes state synchronously (react-hooks rule). */
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    authedFetch<MeResponse>("/me").then((r) => {
      if (!cancelled) setMe(r.ok ? r.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (isPending) return <LoadingView />;

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SignInForm />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {!me ? (
        <LoadingView />
      ) : (
        <View style={styles.card}>
          <Text style={text.pageTitle}>{me.user.name?.trim() || "حسابي"}</Text>

          {!me.profileComplete ? (
            <Text style={[text.body, styles.notice]}>
              أكمِل حسابك (الاسم ورقم الهاتف) لتُحتسب نقاطك عند إنجاز المهام.
            </Text>
          ) : null}

          <View style={styles.tierRow}>
            <Text style={styles.tier}>{me.progress.tier}</Text>
            <Text style={styles.points}>{arabicDigits(me.progress.points)} نقطة</Text>
          </View>

          {me.progress.nextTier ? (
            <Text style={[text.caption, styles.muted]}>
              {arabicDigits(me.progress.pointsToNext ?? 0)} نقطة حتى «{me.progress.nextTier}»
            </Text>
          ) : null}
        </View>
      )}

      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, flexGrow: 1 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.md,
  },
  notice: { color: colors.accent },
  tierRow: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  tier: { ...text.section, color: colors.brand },
  points: { ...text.bodyStrong, color: colors.ink },
  muted: { color: colors.inkMuted },
  signOut: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: space.md,
    alignItems: "center",
  },
  signOutText: { ...text.bodyStrong, color: colors.inkMuted },
});
