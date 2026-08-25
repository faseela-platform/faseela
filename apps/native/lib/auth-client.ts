import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { PROD_FALLBACK, resolveBaseUrl } from "./api";

/**
 * The API/auth origin, resolved exactly as `use-fetch` resolves it for reads: an
 * explicit `EXPO_PUBLIC_API_URL` wins, else the Metro host in dev, else production.
 * Better Auth appends `/api/auth`; the app appends `/api/v1`.
 */
export const baseUrl = resolveBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  isDev: __DEV__,
  fallback: PROD_FALLBACK,
});

/**
 * The mobile auth client.
 *
 * `expoClient` keeps the session in `expo-secure-store` (a phone has no cookie jar)
 * and replays it on requests; `getCookie()` hands that stored session to our own
 * `/api/v1` calls. `emailOTPClient` gives the typed `emailOtp.sendVerificationOtp`
 * and `signIn.emailOtp` methods — the mobile on-ramp, since an emailed magic link
 * cannot reliably deep-link back into the app. The plugin list mirrors the server's
 * for these methods to type-check.
 */
export const authClient = createAuthClient({
  baseURL: baseUrl,
  plugins: [
    /**
     * Cast: `@better-auth/expo` 1.6.26's client plugin does not satisfy the React
     * client's plugin generic — its deep `BetterFetch` option inference blows up
     * against `createAuthClient` (a library *type* limitation; the plugin object is
     * the documented runtime one, validated on-device). Casting to the sibling
     * plugin's type lets the array compose while `emailOTPClient` below keeps the
     * typed `signIn.emailOtp` / `emailOtp.sendVerificationOtp` methods. The expo
     * actions (cookie storage/replay) run untouched; `getCookie` is reached at
     * runtime through `sessionCookie()`.
     */
    expoClient({
      scheme: "faseela",
      storagePrefix: "faseela",
      storage: SecureStore,
    }) as unknown as ReturnType<typeof emailOTPClient>,
    emailOTPClient(),
  ],
});

export const { useSession, signOut } = authClient;

/**
 * The stored session as a `Cookie` header value, or `""` when signed out. The expo
 * plugin exposes `getCookie` at runtime; it is not on the typed client (see the cast
 * above), so it is reached defensively here.
 */
export function sessionCookie(): string {
  return (authClient as unknown as { getCookie?: () => string | undefined }).getCookie?.() ?? "";
}
