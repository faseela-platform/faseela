---
description: "Arabic script and RTL rules for this repo. Use when writing layout, type, motion, or any string that mixes Arabic with numbers or Latin text."
---

# Arabic and RTL

The imported craft skills — `typography`, `interface-animations`, `marketing-pages`, `color-systems` — assume Latin script. Where they disagree with this file, this file wins. Grounded in [W3C Arabic & Persian Layout Requirements](https://www.w3.org/TR/alreq/) (Group Draft Note, 2 Oct 2025) and [UAX #9](http://www.unicode.org/reports/tr9/).

## Stretch Arabic with a font axis, never with letter-spacing

Arabic is cursive: letters join. `letter-spacing` severs those joins, which reads as misspelling rather than styling. W3C §7.3, describing exactly our case of stretching a heading for prominence:

> These instances do not correspond to letter-spacing in non-cursive scripts... the stretching is indicated by stretching the baseline between characters, [and] the stretching is not usually equidistant between all characters.

So `tracking-*` utilities and any `letter-spacing` tween are for Latin runs only.

Two distinct mechanisms produce elongation, and conflating them is the common error:

**Tatweel** is the character `ـ` (U+0640), inserted into the text with a fixed width. It is content — it lives in the CMS string, an Editor decides where it goes, and it cannot animate. Faseela's wordmark (`فَسيلـة`) and headings like `محطــــات` already use it; preserve them exactly as authored.

**Kashida** is the rendered extension of the join. Animating stretch means animating a variable-font axis. Elongation is *not* a registered axis (`wght`, `wdth`, `slnt`, `ital`, `opsz` are the registered set), so any elongation axis is font-specific and custom — verify it exists in the chosen font's axis list before designing motion that depends on it, and fall back to `wdth` or optical scale when it does not.

Apply kashida sparingly and at chosen joins. W3C §7.2.5 names the failure modes: excessive or very long kashidas produce "uneven color", many kashidas in close proximity look "unnatural", and one word should carry at most one. Stretch points are an editorial decision per word, not a uniform transform across a line.

## Isolate every number and Latin run

Digits render left-to-right inside right-to-left text (W3C §3.1). Any string joining a number to Arabic — a Point total, a Season date range, a Leaderboard rank, a duration, a Task count — is a bidi boundary, and an unisolated one makes digits jump to the wrong side of adjacent punctuation. This is the most frequent Arabic UI defect and it lands squarely on Points, Seasons and Leaderboards.

Wrap the foreign run: `<span dir="ltr" style="unicode-bidi: isolate">` in markup, or `\u2068…\u2069` (FSI/PDI) in a plain string. Interpolating a number into a translated template counts, so the i18n layer isolates placeholders by default.

Declare `dir="rtl"` explicitly on the document root. Base direction is otherwise inferred from the first strong character, which makes a paragraph opening with a digit or a Latin brand name silently flip.

## Give Arabic more leading than Latin

W3C §7.4: Arabic ascenders and descenders "extend much further than those of the Latin script." Tailwind's `leading-tight` (1.25) clips them. The Arabic type scale sets its own line heights — see [docs/design/typography.md](../../../docs/design/typography.md) — and display sizes need proportionally more, not less.

Arabic and Latin share no baseline, so a line mixing both needs explicit vertical alignment rather than trusting default alignment.

## Keep motion direction-aware

An entrance that slides "from the right" means *from the start* in Arabic and *from the end* in Latin, so a hardcoded positive `translateX` reverses meaning between directions. Derive the sign from direction, or animate on the inline axis, so one definition serves both.

Skip vertical stacked type. Arabic set vertically rotates along the line rather than stacking one letter per line (W3C §3.1.1) — stacking breaks the join, so that scroll-typography device is unavailable here.

Use Arabic-script counter styles for ordered lists and numbering (W3C §7.5) rather than Latin numerals where the design calls for indigenous counters.

## Verify in the browser, in both directions

Reading the CSS is not enough: joins, descender clipping and bidi jumps only appear when rendered. Screenshot every text-bearing change with `dir="rtl"`, and confirm digits sit where a reader expects when a number abuts Arabic punctuation.
