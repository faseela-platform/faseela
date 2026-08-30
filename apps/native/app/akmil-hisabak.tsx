import type { ProfileResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Mark } from "../components/mark";
import { ScalePressable } from "../components/pressable";
import { authedFetch } from "../lib/authed-api";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";

/**
 * Complete the §5 account (name + phone) — the mobile counterpart to the web
 * `/akmil-hisabak`. Reached when the first attest returns `profile-incomplete`. The
 * phone is stored unverified (§5 defers verification). On success, go back to the
 * Task and let the Member try again.
 */
export default function CompleteAccountScreen() {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (name.trim() === "" || phone.trim() === "") {
      setError("الاسم ورقم الهاتف مطلوبان.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await authedFetch<ProfileResponse>("/profile", {
      method: "POST",
      body: { name: name.trim(), phone: phone.trim() },
    });
    setBusy(false);
    if (r.ok) {
      router.back();
      return;
    }
    setError(r.code === "unauthenticated" ? "سجّل دخولك أولاً." : "تعذّر الحفظ، حاول مجدداً.");
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.markRow}>
          <Mark size={56} night={scheme === "dark"} />
        </View>
        <Text style={styles.title}>أكمِل حسابك</Text>
        <Text style={styles.lede}>نحتاج اسمك ورقم هاتفك لتُحتسب نقاطك عند إنجاز المهام.</Text>

        <View>
          <Text style={styles.label}>الاسم الكامل</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            editable={!busy}
            placeholder="اسمك"
            placeholderTextColor={colors.inkMuted}
            textAlign="right"
          />
        </View>

        <View>
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
            placeholder="70 123 456"
            placeholderTextColor={colors.inkMuted}
            keyboardType="phone-pad"
            inputMode="tel"
            textAlign="left"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScalePressable
          style={[styles.btn, busy && styles.btnBusy]}
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>احفظ</Text>}
        </ScalePressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: { padding: space.lg, flexGrow: 1 },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(2),
    },
    markRow: { alignItems: "flex-start" },
    title: { ...text.section, color: colors.ink },
    lede: { ...text.body, color: colors.inkMuted },
    label: { ...text.captionStrong, color: colors.inkMuted, marginBottom: space.xs },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.btn,
      backgroundColor: colors.surface,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      fontSize: 18,
      color: colors.ink,
      fontFamily: "IBMPlexSansArabic_400Regular",
    },
    error: { ...text.caption, color: colors.danger },
    btn: {
      backgroundColor: colors.brand,
      borderRadius: radius.btn,
      paddingVertical: space.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    btnBusy: { opacity: 0.7 },
    btnText: { ...text.bodyStrong, color: "#ffffff" },
  });
