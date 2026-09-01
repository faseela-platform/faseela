# 31. Android application ID and the first EAS build

Date: 2026-08-31

## Status

Accepted.

## Context

The first attempt to run the mobile app on a real phone (Expo Go, SDK 57) red-screened with
`[Worklets] Mismatch between JavaScript part and native part (0.10.1 vs 0.9.2)`: the project's
`react-native-worklets` is exactly what SDK 57 prescribes, but the phone's Expo Go carried an
older native runtime. Expo Go is therefore not a dependable test vehicle — an EAS build is. EAS
refused to build without `android.package`, and no application ID had ever been decided (no ADR,
nothing in `docs/design/identity.md`). Separately, EAS's default project archiving (a shallow
`git clone` of the working copy) exits 128 on this Windows checkout and would in any case ship
only committed state.

## Decision

- The Android application ID is **`com.faseela24.app`** — the reverse of the one domain the
  initiative owns (`faseela24.com`). The iOS bundle identifier, when needed, will be the same
  string. This ID is permanent once the app reaches a store; it is set in `apps/native/app.json`.
- Signing uses the **EAS-managed cloud keystore** (generated 2026-08-31); no keystore file lives
  in the repo or on any machine.
- EAS builds from this machine run with **`EAS_NO_VCS=1`** so the working tree is archived
  directly (respecting ignore files) instead of the failing shallow clone.
- Phone testing prefers the **`preview` profile APK** (standalone, `EXPO_PUBLIC_API_URL`
  pinned to `https://www.faseela24.com`) over Expo Go; Expo Go remains the quick path only when
  the installed Expo Go demonstrably matches the project SDK.

## Consequences

Changing the application ID later means a new app identity in every store and on every device —
treat `com.faseela24.app` as unchangeable. Anyone building locally must go through EAS (or
`expo prebuild` with the same ID) and will get the cloud keystore automatically.
