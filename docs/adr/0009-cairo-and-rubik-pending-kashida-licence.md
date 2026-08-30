# 9. Cairo and Rubik, with the kashida axis deferred

Date: 2026-08-06

## Status

Accepted. The licensing question was escalated to Abdullah and resolved: **ship free fonts only
(Cairo + Rubik); revisit after launch.** The deferral below stands as written — it is a post-launch
reconsideration, not a blocker.

_2026-08-25 note:_ an "Arabic UI Display" family supplied for consideration was identified from its
name table as Apple's SF Arabic ("subject to the iOS Software License Agreement") — licence-locked
to Apple platforms, 5 Latin glyphs, no variable axis. Rejected; Cairo + Rubik stand. 29LT Idris
remains the documented upgrade path.

_2026-08-29 note (ADR 0029):_ the wordmark weight is now **Cairo 700**, coloured by a gold gradient
through `background-clip: text`. Still live text, still the authored tatweel, still no
letter-spacing.

## Context

The landing page's art direction depends on kinetic Arabic typography. The obvious implementation —
tweening `letter-spacing` on a headline — is not available in Arabic: the script is cursive, and
uniform tracking severs the joins, which reads as misspelling rather than styling. W3C's _Arabic &
Persian Layout Requirements_ §7.3 is explicit that stretching Arabic "does not correspond to
letter-spacing in non-cursive scripts."

Genuine Arabic elongation is a **kashida** — an extension of the join itself — which on the web means
animating a variable-font axis. Elongation is not one of the five registered axes (`wght`, `wdth`,
`slnt`, `ital`, `opsz`), so any such axis is font-specific and custom.

We surveyed the available Arabic variable fonts:

- Of the 16 Arabic variable fonts in existence, **none that is free has an elongation axis.** Cairo
  and Rubik expose `wght` (Cairo adds `slnt`); Almarai is not variable; Apple's SF Arabic has
  `wght` + `opsz` but is licence-locked to Apple platforms and unusable on the web.
- **29LT Idris** exposes a literal `Kashida` axis alongside `Weight` and `Swash`, described by the
  foundry as "a unique variable font tool… may be the first of its kind." 29LT is Pascal Zoghbi's
  foundry in Beirut — a Lebanese type foundry for a Lebanese initiative.

Idris is €200 for the variable font per licence type, with web and desktop licensed separately;
full family bundles run €225–275. Fontstand rents both monthly, which allows prototyping before
committing. Faseela's budget allocates $15,000 to design and development in total, so €200 is
material but not prohibitive — however it is Abdullah's money decision, not ours.

Separately, we measured the vertical metrics of eight candidate Arabic faces from their binaries
(see `docs/design/typography.md`). Arabic ink spans 1.07×–1.61× the Latin extent in the same font,
which rules out several fonts on other grounds and revealed that Almarai clips its own glyphs at the
browser's default line-height.

## Decision

Ship **Cairo** for display and **Rubik** for UI and body text.

Cairo's `wght` 200–1000 range plus its unusual `slnt` axis provides genuine kinetic range without
elongation. Rubik's 1.185em ink span is the tightest measured, which is what dense Leaderboard rows
and Task lists need, and it is variable with strong digits.

Treat the display font as a **swappable token**, not a hardcoded assumption. The type scale, leading
values, and motion specification are all authored so that substituting a licensed display face is a
token change rather than a rewrite.

Defer the licensing question. If Abdullah licenses 29LT Idris, it replaces Cairo at the display level
and its `Kashida` axis unlocks true elongation motion; Rubik stays for dense UI. Prototype on a
Fontstand rental before purchase.

## Consequences

Kinetic Arabic typography on the landing page ships with weight morphing, per-word staggering,
direction-aware clip reveals, and the `slnt` axis — not elongation. The signature kashida stretch in
Faseela's existing wordmark remains **static tatweel**, exactly as authored, which is faithful to the
current identity even if less dynamic than the reference work.

Per-word splitting is mandatory and letter-level splitting is forbidden, since splitting Arabic at
letter boundaries destroys the joins. This constrains which text-splitting utilities we can adopt.

If the licence is later purchased, the motion specification gains a new axis but nothing already
built needs revisiting — the swappable-token constraint is what buys that.

A risk worth naming: an elongation axis on a licensed font is custom, so its behaviour under
interpolation is not guaranteed to match the registered axes. Verify rendering across Safari,
Chrome and Firefox on a rental before committing €200.
