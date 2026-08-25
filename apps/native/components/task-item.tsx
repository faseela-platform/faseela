import type { AttestResponse, TrackDetailResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { authedFetch } from "../lib/authed-api";
import { arabicDigits, row } from "../lib/rtl";
import { colors, radius, space, text } from "../lib/theme";

type Task = TrackDetailResponse["tasks"][number];

/**
 * One Task on a Track's page. `attest` Tasks get a completion button (the mobile
 * mirror of the web AttestButton); `review` Tasks are shown but not yet completable
 * on mobile (submission-with-files is a deferred follow-up). The Member id is never
 * sent — the server derives it from the token — and the §5 profile gate comes back
 * as a status that routes to the completion screen.
 */
export function TaskItem({
  task,
  signedIn,
  done,
  isRTL,
}: {
  task: Task;
  signedIn: boolean;
  done: boolean;
  isRTL: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localDone, setLocalDone] = useState(done);

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

    if (r.ok) {
      setLocalDone(true);
      return;
    }
    if (r.code === "profile-incomplete") {
      router.push("/akmil-hisabak");
      return;
    }
    Alert.alert(
      "تعذّر التأكيد",
      r.code === "conflict"
        ? "لا يمكن تأكيد هذه المهمة الآن."
        : "حدث خطأ، حدّث الصفحة وحاول مجدداً.",
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={styles.instructions}>{task.instructions}</Text>
      <View style={[styles.footer, row(isRTL)]}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{arabicDigits(task.points)} نقطة</Text>
        </View>

        {task.mode === "attest" ? (
          localDone ? (
            <Text style={styles.done}>✓ أُنجزت</Text>
          ) : (
            <Pressable
              style={[styles.btn, busy && styles.btnBusy]}
              onPress={attest}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.btnText}>أكّد الإنجاز</Text>
              )}
            </Pressable>
          )
        ) : (
          <Text style={styles.mode}>مراجعة</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.sm,
  },
  taskTitle: { ...text.cardTitle, color: colors.ink },
  instructions: { ...text.body, color: colors.inkMuted },
  footer: { alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  chip: {
    backgroundColor: colors.chipBg,
    borderRadius: radius.chip,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  chipLabel: { ...text.caption, color: colors.chipInk },
  mode: { ...text.caption, color: colors.inkMuted },
  done: { ...text.bodyStrong, color: colors.brand },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  btnBusy: { opacity: 0.7 },
  btnText: { ...text.bodyStrong, color: colors.surface },
});
