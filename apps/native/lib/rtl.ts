/**
 * Pure RTL helpers — importable under plain node (no react-native imports).
 * Components read `I18nManager.isRTL` themselves and pass it in.
 */

const arabic = new Intl.NumberFormat("ar-EG");

/**
 * When RTL is already applied, React Native lays `row` out right-to-left on
 * its own — reversing it would undo that. The reversal covers the window where
 * RTL has NOT been applied (first Expo Go load before the manifest keys land).
 */
export function row(isRTL: boolean): { flexDirection: "row" | "row-reverse" } {
  return { flexDirection: isRTL ? "row" : "row-reverse" };
}

/** Arabic-Indic digits via ar-EG — the numerals a Faseela reader expects. */
export function arabicDigits(n: number): string {
  return arabic.format(n);
}
