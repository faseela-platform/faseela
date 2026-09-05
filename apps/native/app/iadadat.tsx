import Constants from "expo-constants";
import { router } from "expo-router";
import { Alert, I18nManager, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScalePressable } from "../components/pressable";
import { signOut, useSession } from "../lib/auth-client";
import { row } from "../lib/rtl";
import { radius, space, text } from "../lib/theme";
import { useTheme, useThemeStyles, type Preference } from "../lib/theme-context";

const PREFERENCES: { value: Preference; label: string }[] = [
  { value: "system", label: "تلقائي" },
  { value: "light", label: "نهاري" },
  { value: "dark", label: "ليلي" },
];

const SITE = "https://www.faseela24.com";

/**
 * الإعدادات — the app's preferences and account actions, in the standard mobile
 * place (owner, 2026-09-05). Moved here FROM حسابي so the tab keeps one role —
 * "who I am" (tier, points, سجل أعمالي) — mirroring the web's page-role split
 * (ADR 0036): المظهر (owner D5's light/night/system choice), the account rows,
 * تعديل البيانات, تسجيل الخروج, and the app's version and outbound links.
 * Reached from the الإعدادات row on حسابي; useful signed out too (المظهر works
 * for a visitor — the account card simply says how to sign in).
 */
export default function SettingsScreen() {
  const { data: session } = useSession();
  const { preference, setPreference } = useTheme();
  const styles = useThemeStyles(makeStyles);
  const isRTL = I18nManager.isRTL;

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* المظهر — the same three-way choice the theme provider persists. */}
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

      {/* الحساب — who is signed in, and the two actions that belong to that fact. */}
      <View style={styles.card}>
        <Text style={styles.label}>الحساب</Text>
        {session ? (
          <>
            <View style={[styles.fieldRow, row(isRTL)]}>
              <Text style={styles.fieldName}>الاسم</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {session.user.name?.trim() || "—"}
              </Text>
            </View>
            <View style={[styles.fieldRow, row(isRTL)]}>
              <Text style={styles.fieldName}>البريد</Text>
              <Text style={[styles.fieldValue, styles.ltrValue]} numberOfLines={1}>
                {session.user.email}
              </Text>
            </View>
            <ScalePressable
              style={styles.actionRow}
              onPress={() => router.push("/akmil-hisabak")}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>تعديل بياناتي (الاسم ورقم الهاتف)</Text>
            </ScalePressable>
            <ScalePressable
              style={styles.signOut}
              onPress={() =>
                /** One stray tap must not end the session silently (the lesson from
                 * حسابي, where this button lived before). */
                Alert.alert("تسجيل الخروج", "هل تريد الخروج من حسابك؟", [
                  { text: "إلغاء", style: "cancel" },
                  {
                    text: "تسجيل الخروج",
                    style: "destructive",
                    onPress: () => {
                      void signOut();
                      router.back();
                    },
                  },
                ])
              }
              accessibilityRole="button"
            >
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </ScalePressable>
          </>
        ) : (
          <Text style={styles.muted}>لست مسجَّل الدخول — سجّل دخولك من تبويب «حسابي».</Text>
        )}
      </View>

      {/* عن التطبيق — the version and the initiative's outbound doors. */}
      <View style={styles.card}>
        <Text style={styles.label}>عن التطبيق</Text>
        <View style={[styles.fieldRow, row(isRTL)]}>
          <Text style={styles.fieldName}>الإصدار</Text>
          {/* A version is dotted digits, not a quantity — convert digit by digit. */}
          <Text style={styles.fieldValue}>
            {version.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d)}
          </Text>
        </View>
        <ScalePressable
          style={styles.actionRow}
          onPress={() => void Linking.openURL(SITE)}
          accessibilityRole="link"
        >
          <Text style={styles.actionText}>الموقع الإلكتروني</Text>
        </ScalePressable>
        <ScalePressable
          style={styles.actionRow}
          onPress={() => void Linking.openURL(`${SITE}/tawasol`)}
          accessibilityRole="link"
        >
          <Text style={styles.actionText}>تواصل معنا</Text>
        </ScalePressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = ({ colors, shadow }: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.card,
      padding: space.xl,
      gap: space.md,
      ...shadow(1),
    },
    label: { ...text.captionStrong, color: colors.brand },
    muted: { ...text.body, color: colors.inkMuted },
    fieldRow: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      minHeight: 32,
    },
    fieldName: { ...text.caption, color: colors.inkMuted },
    fieldValue: { ...text.bodyStrong, color: colors.ink, flexShrink: 1 },
    ltrValue: { writingDirection: "ltr" },
    actionRow: {
      minHeight: 44,
      justifyContent: "center",
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    actionText: { ...text.bodyStrong, color: colors.brand },
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
    },
    signOutText: { ...text.bodyStrong, color: colors.inkMuted },
  });
