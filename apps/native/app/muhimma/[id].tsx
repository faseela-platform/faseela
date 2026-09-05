import type {
  SubmitSubmissionResponse,
  TaskSubmissionResponse,
  UploadTicketResponse,
} from "@faseela/api-types";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScalePressable } from "../../components/pressable";
import { useSession } from "../../lib/auth-client";
import { authedFetch } from "../../lib/authed-api";
import { arabicDigits, row } from "../../lib/rtl";
import { submissionPhase } from "../../lib/submission-phase";
import { radius, space, text } from "../../lib/theme";
import { useTheme, useThemeStyles } from "../../lib/theme-context";

/**
 * إرسال عمل للمراجعة (§16–§26) — the phone's side of the review workflow, closing
 * the loop the web opened: write the answer, optionally attach one file (uploaded
 * straight to R2 via a presigned PUT — never through the API server), pick
 * «المحتوى المختار» when the Task offers content (§15 path 2), save a draft (§21)
 * or submit. The screen's affordances follow `submissionPhase` — a pending or
 * finally-judged Submission locks the form and says why — and the reviewer's note
 * on a return is shown above the re-opened form (§23). Errors arrive as codes
 * (authedFetch drops server prose), so the Arabic lives here, mirroring attest.
 */
const ERROR_MESSAGE: Record<string, string> = {
  validation: "اكتب إجابتك أو أرفق ملفاً قبل الإرسال.",
  "invalid-content": "المحتوى المختار غير متاح لهذه المهمة.",
  conflict: "تعذّر الإرسال — حدّث الشاشة فقد تغيّرت حالة عملك.",
  "uploads-unavailable": "رفع الملفات غير متاح حالياً — أرسل نصاً الآن.",
  "unsupported-type": "نوع الملف غير مدعوم. أرفق صورة أو ⁨PDF⁩ أو مستنداً أو مقطعاً.",
  network: "تعذّر الاتصال. تحقّق من الشبكة وحاول مجدداً.",
};

export default function SubmissionScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    instructions?: string;
    points?: string;
  }>();
  const taskId = params.id;
  const { data: session } = useSession();
  const styles = useThemeStyles(makeStyles);
  const { colors } = useTheme();
  const isRTL = I18nManager.isRTL;

  const [loaded, setLoaded] = useState<TaskSubmissionResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [body, setBody] = useState("");
  const [contentId, setContentId] = useState<string | null>(null);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);

  /** Refetch on focus; seed the form from the working copy only on the FIRST load,
   * so a background refetch never overwrites what the Member is typing. A ref, not
   * state — it steers the callback and should never re-render anything. */
  const seededRef = useRef(false);
  const load = useCallback(() => {
    if (!session || !taskId) return;
    let cancelled = false;
    authedFetch<TaskSubmissionResponse>(`/tasks/${taskId}/submission`).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      setLoaded(r.data);
      if (!seededRef.current && r.data.submission) {
        setBody(r.data.submission.body ?? "");
        setContentId(r.data.submission.contentId);
        setMediaKey(r.data.submission.mediaKey);
        if (r.data.submission.mediaKey) setFileName("ملفك المرفق سابقاً");
      }
      seededRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [session, taskId]);
  useFocusEffect(load);

  const phase = submissionPhase(loaded?.submission?.state ?? null);
  const note = loaded?.submission?.reviewNote ?? null;
  const choices = loaded?.choices ?? [];

  async function attachFile() {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    try {
      const ticket = await authedFetch<UploadTicketResponse>("/uploads", {
        method: "POST",
        body: { taskId, filename: asset.name },
      });
      if (!ticket.ok) {
        if (ticket.code === "profile-incomplete") {
          router.push("/akmil-hisabak");
          return;
        }
        Alert.alert("تعذّر الرفع", ERROR_MESSAGE[ticket.code] ?? ERROR_MESSAGE.network!);
        return;
      }
      /** Straight to R2 — a plain fetch with no session header; the presigned URL IS
       * the authorization. */
      const blob = await (await fetch(asset.uri)).blob();
      const put = await fetch(ticket.data.url, {
        method: "PUT",
        headers: { "content-type": asset.mimeType ?? "application/octet-stream" },
        body: blob,
      });
      if (!put.ok) {
        Alert.alert("تعذّر الرفع", "لم يكتمل رفع الملف. حاول مجدداً.");
        return;
      }
      setMediaKey(ticket.data.key);
      setFileName(asset.name);
    } finally {
      setUploading(false);
    }
  }

  async function save(draft: boolean) {
    setBusy(draft ? "draft" : "submit");
    const r = await authedFetch<SubmitSubmissionResponse>(`/tasks/${taskId}/submission`, {
      method: "POST",
      body: { body, mediaKey, contentId, draft },
    });
    setBusy(null);
    if (!r.ok) {
      if (r.code === "profile-incomplete") {
        router.push("/akmil-hisabak");
        return;
      }
      if (r.code === "unauthenticated") {
        Alert.alert("انتهت جلستك", "سجّل دخولك مجدداً من تبويب «حسابي».");
        return;
      }
      Alert.alert(
        draft ? "تعذّر الحفظ" : "تعذّر الإرسال",
        ERROR_MESSAGE[r.code] ?? ERROR_MESSAGE.network!,
      );
      return;
    }
    if (r.data.state === "submitted") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("أُرسل عملك", "سيراجعه المشرف قريباً، وتصلك النتيجة في الإشعارات.");
    }
    load();
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>سجّل دخولك من تبويب «حسابي» لإرسال عملك.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* The Task itself, carried from the road so the Member never loses the brief. */}
      <View style={styles.card}>
        <View style={[styles.head, row(isRTL)]}>
          <Text style={styles.title}>{params.title ?? "المهمة"}</Text>
          {params.points ? (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{arabicDigits(Number(params.points))} نقطة</Text>
            </View>
          ) : null}
        </View>
        {params.instructions ? <Text style={styles.muted}>{params.instructions}</Text> : null}
      </View>

      {loadFailed ? (
        <Text style={styles.muted}>تعذّر تحميل حالة عملك — اسحب للعودة وحاول مجدداً.</Text>
      ) : null}

      {phase.statusLabel ? (
        <View style={[styles.statusRow, row(isRTL)]}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{phase.statusLabel}</Text>
          </View>
        </View>
      ) : null}

      {/* The reviewer's word on a return or rejection (§23) — the reason to improve. */}
      {note ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>ملاحظة المراجع</Text>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {/* §15 path 2 — the Task is about one of these; the Submission records which. */}
      {choices.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>المحتوى المختار</Text>
          <View style={styles.choiceWrap}>
            {choices.map((c) => {
              const on = contentId === c.id;
              return (
                <ScalePressable
                  key={c.id}
                  onPress={() => phase.canEdit && setContentId(on ? null : c.id)}
                  style={[styles.choice, on && styles.choiceOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{c.title}</Text>
                </ScalePressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>إجابتك</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          editable={phase.canEdit && busy === null}
          multiline
          textAlignVertical="top"
          placeholder="اكتب عملك هنا…"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
        />
        <ScalePressable
          style={styles.attach}
          onPress={attachFile}
          disabled={!phase.canEdit || uploading}
          accessibilityRole="button"
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text style={styles.attachText}>
              {fileName ? `📎 ${fileName}` : "أرفق ملفاً (اختياري)"}
            </Text>
          )}
        </ScalePressable>
        {fileName && phase.canEdit ? (
          <ScalePressable
            onPress={() => {
              setMediaKey(null);
              setFileName(null);
            }}
            accessibilityRole="button"
            style={styles.remove}
          >
            <Text style={styles.removeText}>أزل الملف</Text>
          </ScalePressable>
        ) : null}
      </View>

      {phase.canEdit ? (
        <View style={[styles.actions, row(isRTL)]}>
          <ScalePressable
            style={[styles.secondary, busy !== null && styles.disabled]}
            onPress={() => save(true)}
            disabled={busy !== null}
            accessibilityRole="button"
          >
            {busy === "draft" ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Text style={styles.secondaryText}>احفظ مسودة</Text>
            )}
          </ScalePressable>
          <ScalePressable
            style={[styles.primary, busy !== null && styles.disabled]}
            onPress={() => save(false)}
            disabled={busy !== null}
            accessibilityRole="button"
          >
            {busy === "submit" ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>أرسل للمراجعة</Text>
            )}
          </ScalePressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
    content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(1),
    },
    head: { alignItems: "center", justifyContent: "space-between", gap: space.md },
    title: { ...text.cardTitle, color: colors.ink, flexShrink: 1 },
    chip: {
      backgroundColor: colors.chipBg,
      borderRadius: radius.chip,
      paddingVertical: space.xs,
      paddingHorizontal: space.md,
    },
    chipLabel: { ...text.captionStrong, color: colors.chipInk },
    label: { ...text.captionStrong, color: colors.brand },
    muted: { ...text.body, color: colors.inkMuted },
    statusRow: { alignItems: "center" },
    statusPill: {
      backgroundColor: colors.tintBrand,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    statusText: { ...text.captionStrong, color: colors.brand },
    noteCard: {
      backgroundColor: colors.tintBrand,
      borderRadius: radius.card,
      padding: space.lg,
      gap: space.xs,
    },
    noteLabel: { ...text.captionStrong, color: colors.brand },
    noteText: { ...text.body, color: colors.ink },
    choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    choice: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      minHeight: 44,
      justifyContent: "center",
    },
    choiceOn: { borderColor: colors.brand, backgroundColor: colors.tintBrand },
    choiceText: { ...text.captionStrong, color: colors.inkMuted },
    choiceTextOn: { color: colors.brand },
    input: {
      ...text.body,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.btn,
      padding: space.md,
      minHeight: 140,
      writingDirection: "rtl",
      textAlign: "right",
    },
    attach: { minHeight: 44, justifyContent: "center" },
    attachText: { ...text.bodyStrong, color: colors.brand },
    remove: { minHeight: 44, justifyContent: "center" },
    removeText: { ...text.caption, color: colors.inkMuted },
    actions: { gap: space.md },
    primary: {
      flex: 1,
      backgroundColor: colors.brand,
      borderRadius: radius.btn,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { ...text.bodyStrong, color: "#ffffff" },
    secondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.btn,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    secondaryText: { ...text.bodyStrong, color: colors.inkMuted },
    disabled: { opacity: 0.6 },
  });
