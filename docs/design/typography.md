# Typography

The Arabic type scale, derived from measured font metrics rather than Latin defaults.

Referenced by `.claude/skills/faseela-arabic-rtl/SKILL.md`, which governs where this file and the
imported `typography` skill disagree.

## Why this file overrides the imported scale advice

The `typography` skill sets display leading "around 1.1" and body at 1.5–1.6. Those numbers come
from Latin metrics. Measuring eight candidate Arabic webfonts with fontTools shows the Arabic ink
band — ascenders, descenders, and the vowel/diacritic stack — spans **1.07× to 1.61×** the Latin
extent in the same font at the same size:

| Font                 | Arabic ink span | Latin ink span | Ratio |
| -------------------- | --------------- | -------------- | ----- |
| Amiri                | 1.683em         | 1.048em        | 1.61× |
| Cairo                | 1.393em         | 1.084em        | 1.29× |
| Almarai              | 1.380em         | 1.150em        | 1.20× |
| ReemKufi             | 1.376em         | 1.179em        | 1.17× |
| IBM Plex Sans Arabic | 1.344em         | 1.188em        | 1.13× |
| Rubik                | 1.185em         | 1.110em        | 1.07× |

A display leading of 1.1 clips six of the eight. Tailwind's `leading-tight` (1.25) clips five.
**The Arabic display floor is ≈1.4** for a sans face and 1.7 for Naskh.

Reproduce with `_manus/scripts/measure_arabic_metrics.py`.

## Declared metrics are unreliable — always set leading explicitly

`line-height: normal` uses the font's declared `hhea` ascent/descent, which in Arabic fonts
frequently disagrees with the font's own ink:

| Font    | Browser `normal` | Actual ink | Result                                   |
| ------- | ---------------- | ---------- | ---------------------------------------- |
| Almarai | 1.116            | 1.380      | **clips by 0.26em with no CSS involved** |
| Rubik   | 1.185            | 1.185      | flush, zero tolerance                    |
| Cairo   | 1.874            | 1.393      | 0.48em over-reserved                     |

Never rely on `normal`. Every text style in this system sets a unitless `line-height`.

## Typefaces

Two faces, per the skill's norm.

**Display — Cairo.** Variable (`wght` 200–1000, plus an unusual `slnt` axis). Ink span 1.393.
The weight range is what gives kinetic headlines their range in the absence of an elongation axis.

**UI and body — Rubik.** Variable (`wght`). Ink span 1.185 — the tightest measured, which is what
dense Leaderboard rows and Task lists need. Strong digits.

Neither has a kashida/elongation axis; no free Arabic font does. See ADR 0009 if display type is
later replaced by a licensed face with a `Kashida` axis, which would supersede Cairo here.

## The scale

Role-named, because more than one agent commits to this repo and a size-named step does not police
its own use. 1.25 ratio on a 16px root.

```css
:root {
  /* Size */
  --text-caption: 0.8rem; /* 12.8px */
  --text-body-sm: 0.9rem; /* 14.4px */
  --text-body: 1rem; /* 16px   */
  --text-body-lg: 1.125rem; /* 18px   */
  --text-card-title: 1.25rem; /* 20px   */
  --text-section: 1.563rem; /* 25px   */
  --text-page-title: 1.953rem; /* 31.2px */
  --text-display: 2.441rem; /* 39.1px */
  --text-hero: 3.052rem; /* 48.8px */
  --text-hero-lg: 3.815rem; /* 61px   */

  /* Leading — floors derived from measured Arabic ink, not Latin convention */
  --leading-caption: 1.6;
  --leading-body: 1.75; /* Arabic body needs more air than Latin's 1.5 */
  --leading-title: 1.5;
  --leading-section: 1.45;
  --leading-display: 1.42; /* the floor: Cairo ink span is 1.393 */
  --leading-hero: 1.42;
}
```

Body leading is **1.75**, not 1.5. The Arabic ink band consumes more of the line box, so Latin's
1.5 leaves visibly less breathing room between Arabic lines than it does between Latin ones. Matching
the _perceived_ rhythm requires the larger number.

Display leading does not drop below **1.42** at any size. Large Arabic type does not get tighter
leading the way Latin does — the diacritics and descenders scale with it.

## Tracking

`letter-spacing` is **forbidden on Arabic text**. Arabic is cursive; uniform tracking severs the
joins and reads as misspelling. See the RTL skill for the W3C citation.

This means the skill's advice — negative tracking on display sizes, positive on small caps — applies
**only to Latin runs**, which in an Arabic-only MVP means effectively nowhere. Do not reach for
`tracking-tight` on a heading.

```css
/* WRONG — severs Arabic joins */
.hero-title {
  letter-spacing: -0.015em;
}

/* RIGHT — tighten optically with weight and size instead */
.hero-title {
  font-size: var(--text-hero);
  line-height: var(--leading-hero);
  font-variation-settings: "wght" 700;
}
```

Where a Latin run genuinely needs tracking, scope it:

```css
[lang="en"] .eyebrow {
  letter-spacing: 0.06em;
}
```

## text-box trimming

`text-box: trim-both cap alphabetic` assumes Latin cap-height and baseline edges. Arabic has no cap
height, and the trim will crop diacritics. Use `text` rather than `cap`/`alphabetic` on Arabic, and
ship any trimming as progressive enhancement that degrades to untrimmed:

```css
.tag:lang(ar) {
  text-box: trim-both text text;
}
```

## Numbers

Every number adjacent to Arabic is a bidi boundary and must be isolated — see the RTL skill. Use
tabular figures wherever numbers align in columns, which for this product means Point totals and
Leaderboard ranks:

```css
.point-total,
.leaderboard-rank {
  font-variant-numeric: tabular-nums;
}
```

## Polish rules (Slice 9, 2026-08-29)

Applied once in `apps/web/app/globals.css`, so components never repeat them:

| Rule                                                                                 | Why                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `html { font-synthesis: none }`                                                      | A missing weight must fall back to a real one; faux-bold smears Arabic joins.                                                                                                                      |
| `html { font-optical-sizing: auto }`                                                 | Lets a face with an `opsz` axis (the Idris upgrade path) size itself. Cairo ignores it.                                                                                                            |
| `h1, h2, h3 { text-wrap: balance }`                                                  | Word-level rebalancing — never touches a join.                                                                                                                                                     |
| `.text-lede, .lede { text-wrap: pretty }`                                            | Kills the orphaned last word in ledes.                                                                                                                                                             |
| `.num { font-variant-numeric: tabular-nums }`                                        | Every `.num` is a live quantity in a column or a counter.                                                                                                                                          |
| `a { text-decoration-thickness: from-font; text-underline-offset: .16em; skip-ink }` | Underlines that clear Arabic descenders.                                                                                                                                                           |
| `::selection` gold tint                                                              | Highlight reads as highlight, not as a teal control.                                                                                                                                               |
| `.wordmark`                                                                          | فسيلـــة in Cairo 700 with the gold gradient clipped to the glyphs (ADR 0029); flat accent gold where `background-clip: text` is unsupported; selection override so selected letters stay visible. |

Still no `letter-spacing` anywhere — `scripts/verify-page.mjs` fails the build if an Arabic
element carries it.

## Tailwind mapping

Tailwind's default `leading-*` utilities are Latin-calibrated and mostly unusable here. The theme
extension replaces them rather than supplementing them, so `leading-tight` cannot be reached by
accident. Configuration lands in `packages/ui` when that package is created.
