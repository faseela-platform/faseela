import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { palette, shadow, type Colors, type Scheme } from "./theme";

/**
 * Light by default, night by choice — the app follows the same decision as the web
 * (owner D5): the OS scheme decides unless the Member picked one in حسابي, and the
 * pick persists across launches.
 */
export type Preference = "system" | Scheme;

const KEY = "faseela-theme";

type ThemeValue = {
  scheme: Scheme;
  preference: Preference;
  colors: Colors;
  setPreference: (p: Preference) => void;
  /** Card/raised elevation for the scheme in force. */
  shadow: (level?: 1 | 2) => ReturnType<typeof shadow>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<Preference>("system");

  // Restore the saved choice once; until it lands the OS scheme is in force, which is
  // also what a first launch shows — no flash of the wrong palette for a system user.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!cancelled && (v === "light" || v === "dark" || v === "system")) setPreferenceState(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: Preference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);

  const scheme: Scheme =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeValue>(() => {
    const colors = palette(scheme);
    return {
      scheme,
      preference,
      colors,
      setPreference,
      shadow: (level = 1) => shadow(colors, scheme, level),
    };
  }, [scheme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}

/**
 * Screens build their StyleSheet from the palette in force. Memoised on the scheme so
 * a re-render never re-creates styles, and a theme switch re-creates them once.
 */
export function useThemeStyles<T>(factory: (t: ThemeValue) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the factory is a module constant
  return useMemo(() => factory(theme), [theme.scheme]);
}
