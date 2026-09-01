# 32. The road, the seedling, and the owner decision round

Date: 2026-09-01

## Status

Accepted. Records the twelve owner decisions of 2026-09-01 and the UI batch that
implemented the first four.

## Context

After the first real device test (preview APK, ADR 0031), the owner asked for a
task journey ("a multicurved road with sprouts"), playful gamification, and a
full v1-vs-spec audit. Three agent reports were produced (roadmap directions +
اللوحة audit; mobile UX + the "missing خروج"; the spec audit of
المواصفات التفصيلية §1–§49). Twelve MCQs were put to the owner; all twelve were
answered. The «missing خروج» turned out not to be a bug: the button was always
rendered — the device was locally signed out, silently (the ADR 0030 stale-token
sign-out carried no message), and the preview APK is a fresh app identity whose
SecureStore shares nothing with Expo Go.

## Decisions (owner, 2026-09-01)

1. **طريق الفسائل, built directly** (not the stem-rail phase-1): the Track page's
   Tasks walk a winding road. Web: a serpentine lane down a single-column list,
   cards alternating sides, one stretched S-curve SVG segment per row
   (`aria-hidden`; the `<ol>` stays the accessible truth), authored RTL-first and
   flipped as one unit for LTR. Native: a per-item rail segment in
   react-native-svg so the FlatList stays virtualized. Sprout stages map the real
   submission lifecycle (`lib/road.ts`): soil → seed (draft/cancelled) → bud
   (pending) → drooping leaf (returned) → seedling (accepted/attested) — and a
   stone for a final rejection. **Nothing locks**: walked earth (gold over the
   hairline bed) measures where the Member has arrived, never gates what is
   ahead, because task gating is not in the spec.
2. اللوحة stays scorers-only; a **sparse board (<5 rows) adds an invitation**
   («اللوحة ما زالت في أولها — كن أول المتصدرين»), and the native empty copy is
   aligned with the web's.
3. **Gamification quartet**, all pure client, all reduced-motion-aware:
   point-mint chip + success haptic on a fresh attest (the outcome now carries
   `points`, `null` on a re-tap so a second award is never implied); tier-up
   celebration replaying the brand grow Lottie; a season countdown chip on
   اللوحة (`lib/season.ts`, Arabic number agreement); and **فسيلتك** — the mark
   itself on حسابي, revealed bottom-up by lifetime progress toward the next رتبة
   (clipped, never redrawn: ADR 0029 holds). مركزك and a مواظبة streak need API
   work and their own decisions — deferred.
4. **Mobile opens on المستجدّات**: the feed is now the tabs' index route (`/` =
   home, mirroring ADR 0030's web home) and the Tracks list moved to the
   `masarat` tab route. No hero screen, ever — the Lottie splash is the brand
   moment; a dismissible welcome card greets signed-out visitors in the feed.
   The silent sign-out now speaks («انتهت جلستك، سجّل دخولك مجدداً») and خروج
   asks before acting.
5. Tier thresholds will be re-seeded to spec (عام 0 / خاص 100 / متقدم 200 /
   فسيلي 1000); §20 becomes per-task toggles; the follow model backfills from
   worked-in tracks; the v2 order is Slices 12–21 as drafted; Zone 5 ships as
   simple discovery in Slice 12; points adjustment = signed ledger appends with
   required reason; the remaining six tracks are seeded as drafts; mobile
   completion starts with review submission. (Execution: future slices.)

## Consequences

The Track page is now single-column on every viewport; the two-column task grid
is gone. The road adds no client JavaScript on web (stages and walked-fraction
are server-computed) and no measurement passes on native. Slice-local questions
still open: the §7 400–999 band (blocks the tier re-seed's fifth row), «كتاب»
modeling, onboarding mechanism, برامج/هيئات representation, track logo/about.
