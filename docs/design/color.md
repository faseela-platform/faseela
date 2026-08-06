# Color

Two hues on neutral paper, measured from Faseela's own logo.

## Where these values come from

Sampled from the original 1080×1080 logo asset, not a screenshot. ~1.16M pixels filtered by
saturation to separate ink from paper, the antialiased edge band (0.06–0.30 saturation) discarded,
remaining ink clustered by OKLCH hue, modal value taken per cluster.

| Role in the mark | Hex | OKLCH |
|---|---|---|
| Seedling leaves **and book** | `#0eb29a` | `oklch(0.684 0.124 178.3)` |
| Stem, wordmark, ornament | `#9b8137` | `oklch(0.613 0.098 89.8)` |
| Paper ground | `#f2f2f2` | `oklch(0.961 0 89.9)` |

Reproduce with `_manus/scripts/sample_brand2.py`.

The two hues sit **88.5° apart** at near-equal lightness (0.684 vs 0.613). Neither dominates; they
read as equal partners. Any change to the ramps must preserve that parity.

The paper is `C = 0.0` — a true neutral. There is no cream in this identity. Crimson and olive seen
on Instagram highlight covers are photography, not brand colours.

## The constraint that shapes everything

**The seedling teal sits at 99% of the sRGB chroma ceiling at its lightness** (ceiling 0.126,
measured 0.124). It is as vivid as sRGB allows.

Consequences:
- There is no "more vivid teal" available. Requests to make it pop must be met with lightness or
  area, not saturation.
- The teal is fragile under `opacity`, `filter`, and blend modes over coloured grounds — all of
  which clip. Composite it at full strength or not at all.
- A P3 variant is possible behind `@media (color-gamut: p3)` but must not be the baseline.

Stem gold sits at 78% of its ceiling and has normal headroom.

## The ramps

Generated per the `color` skill: hue fixed, lightness evenly spaced 0.97 → 0.22, chroma set as a
fraction of **each step's own** sRGB ceiling (binary-searched per step) so both hues read as equally
vivid despite different absolute chroma. Never copy an absolute C between hues.

```css
:root {
  /* seedling — primary. The growth metaphor: leaves, book, progress. */
  --seedling-50:  oklch(0.97 0.004 178.3);   /* #f2f6f5 */
  --seedling-100: oklch(0.895 0.046 178.3);  /* #bde7dc */
  --seedling-200: oklch(0.82 0.075 178.3);   /* #8ed5c4 */
  --seedling-300: oklch(0.745 0.096 178.3);  /* #61c0ad */
  --seedling-400: oklch(0.67 0.105 178.3);   /* #3aaa96 */
  --seedling-500: oklch(0.595 0.093 178.3);  /* #30917f */
  --seedling-600: oklch(0.52 0.075 178.3);   /* #2f7769 */
  --seedling-700: oklch(0.445 0.052 178.3);  /* #315d54 */
  --seedling-800: oklch(0.37 0.033 178.3);   /* #2c4640 */
  --seedling-900: oklch(0.295 0.017 178.3);  /* #242f2d */
  --seedling-950: oklch(0.22 0.009 178.3);   /* #161c1b */

  /* stem — accent. Reward, emphasis, Points, ornament. */
  --stem-50:  oklch(0.97 0.004 89.8);   /* #f6f5f2 */
  --stem-100: oklch(0.895 0.037 89.8);  /* #e6dcc1 */
  --stem-200: oklch(0.82 0.084 89.8);   /* #d9c284 */
  --stem-300: oklch(0.745 0.107 89.8);  /* #c7a958 */
  --stem-400: oklch(0.67 0.116 89.8);   /* #b19134 */
  --stem-500: oklch(0.595 0.103 89.8);  /* #977b2b */
  --stem-600: oklch(0.52 0.083 89.8);   /* #7c662a */
  --stem-700: oklch(0.445 0.058 89.8);  /* #60522c */
  --stem-800: oklch(0.37 0.036 89.8);   /* #473f29 */
  --stem-900: oklch(0.295 0.019 89.8);  /* #302c22 */
  --stem-950: oklch(0.22 0.01 89.8);    /* #1c1a15 */

  /* paper — neutral. Surfaces, text, borders. */
  --paper-50:  oklch(0.985 0.004 178.3); /* #f7fbfa */
  --paper-100: oklch(0.902 0.004 178.3); /* #dce0df */
  --paper-200: oklch(0.82 0.004 178.3);  /* #c1c5c4 */
  --paper-300: oklch(0.738 0.004 178.3); /* #a7abaa */
  --paper-400: oklch(0.655 0.004 178.3); /* #8e9191 */
  --paper-500: oklch(0.573 0.004 178.3); /* #767978 */
  --paper-600: oklch(0.49 0.006 178.3);  /* #5d6260 */
  --paper-700: oklch(0.408 0.006 178.3); /* #464b4a */
  --paper-800: oklch(0.325 0.006 178.3); /* #313534 */
  --paper-900: oklch(0.243 0.006 178.3); /* #1d2120 */
  --paper-950: oklch(0.16 0.006 178.3);  /* #0b0e0d */
}
```

The neutral carries a near-imperceptible teal cast (C 0.004–0.006 at the seedling hue) so surfaces
feel of-a-piece with the brand rather than dead grey. This is a deliberate departure from the
measured `C = 0.0`; see ADR 0010.

## Contrast — verified, not assumed

APCA Lc on `--paper-50`. Floors: **60** body text, 75 preferred, 45 large text, 30 non-text.

| Step | seedling | stem | Usable for |
|---|---|---|---|
| 300 | 39.5 | 41.7 | non-text only |
| 400 | 51.3 | 53.7 | large text only |
| 500 | 62.7 | 64.6 | body text |
| 600 | 73.2 | 74.6 | body text |
| 700 | 82.7 | 83.5 | body, preferred |

**The brand teal as it appears in the logo (≈step 400) reaches Lc 51.3 — large text only. It fails
the body-text floor.** This is not a defect in the identity: the logo uses teal as a *fill*, never as
small text. The rule follows the identity rather than fighting it.

> Brand colours are for fills, large display text, and non-text UI.
> Body text uses step 700 or darker, or neutral ink.

## Semantic roles

```css
:root {
  --surface: var(--paper-50);
  --surface-raised: white;
  --border: var(--paper-200);
  --ink: var(--paper-950);
  --ink-muted: var(--paper-500);   /* Lc 67.6 — legitimate body text */
  --brand: var(--seedling-500);
  --brand-fill: var(--seedling-400);
  --accent: var(--stem-500);
  --accent-fill: var(--stem-400);
}

[data-theme="dark"] {
  --surface: var(--paper-950);
  --surface-raised: var(--paper-900);
  --border: var(--paper-800);
  --ink: var(--paper-50);
  --ink-muted: var(--paper-400);
  --brand: var(--seedling-200);
  --brand-fill: var(--seedling-300);
  --accent: var(--stem-200);
  --accent-fill: var(--stem-300);
}
```

**Dark mode must not reuse the light-mode steps.** Verified on `--paper-950`:

| Step | seedling Lc | Verdict |
|---|---|---|
| 200 | 72.5 | body OK |
| 300 | 59.5 | large only |
| 500 | **35.8** | fails even large-text floor |

A naive dark mode reusing step 500 lands at Lc 35.8. Brand roles invert to **steps 100–200**.

## Semantic status colours

Not yet defined. When added, build them at the same L per step and the same fraction of their own
ceiling as the two brand ramps, so the palette reads as one system. Do not import a stock red/green.

## Rules

- Reference tokens, never raw hex or raw `oklch()` in components.
- Never copy an absolute chroma between hues.
- Verify every new text/background pair with APCA before shipping; do not infer from the ramp step.
- No gradients or outlines on the mark itself — the identity is flat ink.
