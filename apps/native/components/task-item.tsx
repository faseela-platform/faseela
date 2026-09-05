import type { AttestResponse, TrackDetailResponse } from "@faseela/api-types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { attestOutcome, isTaskDone } from "../lib/attest";
import { authedFetch } from "../lib/authed-api";
import { arabicDigits, row } from "../lib/rtl";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";
import { ScalePressable } from "./pressable";

type Task = TrackDetailResponse["tasks"][number];

/**
 * One Task on a Track's page. `attest` Tasks get a completion button (the mobile
 * mirror of the web AttestButton); `review` Tasks open the submission screen
 * (muhimma/[id] — text, file, المحتوى المختار). The Member id is never
 * sent — the server derives it from the token — and the §5 profile gate comes back
 * as a status that routes to the completion screen.
 *
 * Done-state is derived, never seeded: `done` (the Member's `completedTaskIds` from
 * `/me`) can land after this item mounts, and a local attest must not wait for it.
 */
export function TaskItem({
  task,
  signedIn,
  done,
  isRTL,
  index,
}: {
  task: Task;
  signedIn: boolean;
  done: boolean;
  isRTL: boolean;
  index: number;
}) {
  const router = useRouter();
  const styles = useThemeStyles(makeStyles);
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [localDone, setLocalDone] = useState(false);
  const isDone = isTaskDone(done, localDone);

  /** The fresh mint to celebrate — a gold «+N» that rises off the button and fades.
   * Only a first completion sets it (a re-tap carries `points: null`), and reduced
   * motion skips the float entirely; the ✓ line is the durable confirmation. */
  const [minted, setMinted] = useState<number | null>(null);
  useEffect(() => {
    if (minted === null) return;
    const id = setTimeout(() => setMinted(null), 1400);
    return () => clearTimeout(id);
  }, [minted]);

  async function attest() {
    if (!signedIn) {
      Alert.alert("سجّل دخولك أولاً", "افتح تبويب «حسابي» وسجّل الدخول لتُحتسب نقاطك.");
      return;
    }
    setBusy(true);
    const r = await authedFetch<AttestResponse>("/attest", {
      method: "POST",
      body: { taskId: task.id },
    });
    setBusy(false);

    const outcome = attestOutcome(r);
    switch (outcome.kind) {
      case "done":
        setLocalDone(true);
        if (outcome.points !== null) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (reduced === false) setMinted(outcome.points);
        }
        return;
      case "complete-profile":
        router.push("/akmil-hisabak");
        return;
      case "sign-in":
        /** A stale token: the sign-in form lives on the حسابي tab, so offer the way there. */
        Alert.alert("انتهت جلستك", "سجّل دخولك مجدداً من تبويب «حسابي» لتُحتسب نقاطك.", [
          { text: "لاحقاً", style: "cancel" },
          { text: "تسجيل الدخول", onPress: () => router.navigate("/hisabi") },
        ]);
        return;
      case "error":
        Alert.alert("تعذّر التأكيد", outcome.message);
        return;
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.head, row(isRTL)]}>
        {/* The ordinal in gold — the identity's voice for the things it counts. */}
        <Text style={styles.ordinal}>{String(index + 1).padStart(2, "0")}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{arabicDigits(task.points)} نقطة</Text>
        </View>
      </View>
      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={styles.instructions}>{task.instructions}</Text>
      <View style={[styles.footer, row(isRTL)]}>
        {minted !== null ? (
          <Animated.View
            entering={FadeInDown.duration(260)}
            exiting={FadeOut.duration(300)}
            style={styles.mint}
            pointerEvents="none"
          >
            <Text style={styles.mintText}>+{arabicDigits(minted)} نقطة</Text>
          </Animated.View>
        ) : null}
        <Text style={styles.mode}>
          {task.mode === "attest" ? "تأكيد ذاتي" : "بحاجة إلى مراجعة"}
        </Text>

        {task.mode === "attest" ? (
          isDone ? (
            <Text style={styles.done}>✓ أُنجزت</Text>
          ) : (
            <ScalePressable
              style={[styles.btn, busy && styles.btnBusy]}
              onPress={attest}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.btnText}>أكّد الإنجاز</Text>
              )}
            </ScalePressable>
          )
        ) : isDone ? (
          <Text style={styles.done}>✓ قُبل عملك</Text>
        ) : (
          /** The review path (§16–§26): the submission screen owns the form; a
           * signed-out tap gets the same nudge attest gives. */
          <ScalePressable
            style={styles.btn}
            onPress={() => {
              if (!signedIn) {
                Alert.alert("سجّل دخولك أولاً", "افتح تبويب «حسابي» وسجّل الدخول لإرسال عملك.");
                return;
              }
              router.push({
                pathname: "/muhimma/[id]",
                params: {
                  id: task.id,
                  title: task.title,
                  instructions: task.instructions,
                  points: String(task.points),
                },
              });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>أرسل عملك</Text>
          </ScalePressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.sm,
      ...shadow(1),
    },
    head: { alignItems: "center", justifyContent: "space-between" },
    ordinal: {
      fontFamily: "Cairo_800ExtraBold",
      fontSize: 22,
      color: colors.accent,
      writingDirection: "ltr",
    },
    taskTitle: { ...text.cardTitle, color: colors.ink },
    instructions: { ...text.body, color: colors.inkMuted },
    footer: {
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: space.xs,
      minHeight: 44,
    },
    chip: {
      backgroundColor: colors.chipBg,
      borderRadius: radius.chip,
      paddingVertical: space.xs,
      paddingHorizontal: space.md,
    },
    chipLabel: { ...text.captionStrong, color: colors.chipInk },
    mode: { ...text.caption, color: colors.inkMuted },
    done: { ...text.bodyStrong, color: colors.accentInk },
    btn: {
      backgroundColor: colors.brand,
      borderRadius: radius.btn,
      paddingVertical: space.sm,
      paddingHorizontal: space.lg,
      minWidth: 112,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    btnBusy: { opacity: 0.7 },
    btnText: { ...text.bodyStrong, color: "#ffffff" },
    mint: {
      position: "absolute",
      bottom: 44,
      end: 0,
      backgroundColor: colors.chipBg,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      zIndex: 1,
    },
    mintText: { ...text.captionStrong, color: colors.chipInk },
  });
