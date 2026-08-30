import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { authClient } from "../lib/auth-client";
import { useTheme, useThemeStyles } from "../lib/theme-context";
import { radius, space, text } from "../lib/theme";
import { Mark } from "./mark";
import { ScalePressable } from "./pressable";

/**
 * Sign in on the phone with an email one-time code (§1/§5): enter email → receive a
 * six-digit code by email → type it in. No deep link — the code round-trips through
 * the email app, not a browser. On success the shared `useSession` flips and the
 * screen hosting this form re-renders to the signed-in view.
 */
export function SignInForm() {
  const { colors, scheme } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const address = email.trim();
    if (address === "") {
      setError("أدخِل بريدك الإلكتروني.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: "sign-in",
    });
    setBusy(false);
    if (e) {
      setError("تعذّر إرسال الرمز. تأكّد من البريد وحاول مجدداً.");
      return;
    }
    setStep("code");
  }

  async function verify() {
    const code = otp.trim();
    if (code === "") {
      setError("أدخِل الرمز المُرسَل إلى بريدك.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code });
    setBusy(false);
    if (e) {
      setError("الرمز غير صحيح أو منتهٍ. اطلب رمزاً جديداً.");
      return;
    }
    // Success: useSession updates and the host screen swaps to the signed-in view.
  }

  return (
    <View style={styles.card}>
      <View style={styles.markRow}>
        <Mark size={64} night={scheme === "dark"} />
      </View>
      <Text style={styles.title}>الدخول إلى فسيلة</Text>
      <Text style={styles.lede}>
        {step === "email"
          ? "أدخِل بريدك الإلكتروني ليصلك رمز الدخول."
          : `أدخِل الرمز المُرسَل إلى ${email.trim()}.`}
      </Text>

      {step === "email" ? (
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="email"
          textAlign="left"
        />
      ) : (
        <TextInput
          style={[styles.input, styles.otp]}
          value={otp}
          onChangeText={setOtp}
          editable={!busy}
          placeholder="123456"
          placeholderTextColor={colors.inkMuted}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          textAlign="center"
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScalePressable
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={step === "email" ? sendCode : verify}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>{step === "email" ? "أرسِل الرمز" : "تأكيد الدخول"}</Text>
        )}
      </ScalePressable>

      {step === "code" ? (
        <ScalePressable
          onPress={() => {
            setStep("email");
            setOtp("");
            setError(null);
          }}
          disabled={busy}
          style={styles.ghost}
          accessibilityRole="button"
        >
          <Text style={styles.change}>تغيير البريد</Text>
        </ScalePressable>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(2),
    },
    markRow: { alignItems: "flex-start", marginBottom: space.xs },
    title: { ...text.section, color: colors.ink },
    lede: { ...text.body, color: colors.inkMuted },
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
    otp: { fontSize: 24, letterSpacing: 6, fontFamily: "IBMPlexSansArabic_600SemiBold" },
    error: { ...text.caption, color: colors.danger },
    button: {
      backgroundColor: colors.brand,
      borderRadius: radius.btn,
      paddingVertical: space.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    buttonBusy: { opacity: 0.7 },
    buttonText: { color: "#ffffff", fontSize: 16, fontFamily: "Cairo_700Bold" },
    ghost: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    change: { ...text.captionStrong, color: colors.brand, textAlign: "center" },
  });
