import type { ProfileResponse } from "@faseela/api-types";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { authedFetch } from "../lib/authed-api";
import { colors, radius, space, text } from "../lib/theme";

/**
 * Complete the §5 account (name + phone) — the mobile counterpart to the web
 * `/akmil-hisabak`. Reached when the first attest returns `profile-incomplete`. The
 * phone is stored unverified (§5 defers verification). On success, go back to the
 * Task and let the Member try again.
 */
export default function CompleteAccountScreen() {
  const router = useRouter();
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
        <Text style={text.cardTitle}>أكمِل حسابك</Text>
        <Text style={[text.body, styles.lede]}>
          نحتاج اسمك ورقم هاتفك لتُحتسب نقاطك عند إنجاز المهام.
        </Text>

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

        <Pressable style={[styles.btn, busy && styles.btnBusy]} onPress={save} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.btnText}>احفظ</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.md,
  },
  lede: { color: colors.inkMuted },
  label: { ...text.caption, color: colors.inkMuted, marginBottom: space.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 18,
    color: colors.ink,
    fontFamily: "IBMPlexSansArabic_400Regular",
  },
  error: { ...text.caption, color: "#b4443a" },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnBusy: { opacity: 0.7 },
  btnText: { ...text.bodyStrong, color: colors.surface },
});
