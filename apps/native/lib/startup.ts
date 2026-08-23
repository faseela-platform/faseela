/**
 * Whether the splash screen should come down.
 *
 * True on success AND on failure: a font error must open the app with system
 * Arabic fonts, never hold the splash forever. One dropped font download over
 * a bad connection is a degraded look, not a reason the app refuses to start.
 * Guarded by tests/startup.test.ts.
 */
export function shouldHideSplash(fontsLoaded: boolean, fontError: Error | null): boolean {
  return fontsLoaded || fontError !== null;
}
