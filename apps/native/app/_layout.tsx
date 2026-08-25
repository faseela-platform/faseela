import { Cairo_400Regular, Cairo_700Bold } from "@expo-google-fonts/cairo";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_600SemiBold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { shouldHideSplash } from "../lib/startup";
import { colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_600SemiBold,
  });

  /**
   * Hide on error too — a failed font download opens the app with system
   * Arabic fonts. Holding the splash on error turned one lost request into
   * an app that never started (see lib/startup.ts).
   */
  const ready = shouldHideSplash(fontsLoaded, fontError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: "Cairo_700Bold" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="masarat/[slug]" options={{ title: "المسار" }} />
        <Stack.Screen name="akmil-hisabak" options={{ title: "أكمِل حسابك", presentation: "modal" }} />
        <Stack.Screen name="ishaarat" options={{ title: "الإشعارات" }} />
      </Stack>
    </>
  );
}
