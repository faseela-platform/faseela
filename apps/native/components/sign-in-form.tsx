import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { authClient } from "../lib/auth-client";
import { colors, radius, space, text } from "../lib/theme";

/**
 * Sign in on the phone with an email one-time code (§1/§5): enter email → receive a
 * six-digit code by email → type it in. No deep link — the code round-trips through
 * the email app, not a browser. On success the shared `useSession` flips and the
 * screen hosting this form re-renders to the signed-in view.
 */
export function SignInForm() {
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
      <Text style={text.cardTitle}>الدخول إلى فسيلة</Text>
      <Text style={[text.body, styles.lede]}>
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
          style={styles.input}
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

      {error ? <Text style={[text.caption, styles.error]}>{error}</Text> : null}

      <Pressable
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={step === "email" ? sendCode : verify}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>{step === "email" ? "أرسِل الرمز" : "تأكيد الدخول"}</Text>
        )}
      </Pressable>

      {step === "code" ? (
        <Pressable
          onPress={() => {
            setStep("email");
            setOtp("");
            setError(null);
          }}
          disabled={busy}
        >
          <Text style={[text.caption, styles.change]}>تغيير البريد</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.md,
  },
  lede: { color: colors.inkMuted },
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
  error: { color: "#b4443a" },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonBusy: { opacity: 0.7 },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  change: { color: colors.brand, textAlign: "center" },
});
