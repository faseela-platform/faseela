# Motion

The motion system: shared tokens, the RTL rules that override the imported skills, and the split
between product UI and the landing page.

Governed by `.claude/skills/animations` and `.claude/skills/faseela-arabic-rtl`. Where they
disagree, the RTL skill wins. ADR 0007 records why the landing page is permitted motion the
`marketing-pages` skill would otherwise forbid.

## Two motion registers

The `animations` skill's first decision framework is *frequency*, and this product splits cleanly:

**Product UI** — the Home feed, Tracks, Tasks, Points, Leaderboards. Used repeatedly, often daily.
Motion here is feedback only: under 300ms, transform/opacity only, exits faster than enters. A
Member checking their Point total is not an audience.

**Landing page** — seen once, by a visitor deciding whether Faseela is serious. Longer, showier
motion is legitimate here and nowhere else.

Never import a landing-page pattern into product UI. The reverse — using product restraint on the
landing page — is always safe.

## Tokens

```css
:root {
  /* Durations */
  --dur-hover: 130ms;
  --dur-press: 150ms;
  --dur-popover: 180ms;
  --dur-modal: 240ms;
  --dur-modal-exit: 170ms;   /* ~30% faster than enter */
  --dur-drawer: 290ms;
  --dur-drawer-exit: 200ms;
  --dur-page: 360ms;

  /* Easing */
  --ease-enter: cubic-bezier(0.32, 0.72, 0, 1);  /* the default for enters */
  --ease-move: cubic-bezier(0.4, 0, 0.2, 1);     /* on-screen movement */
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);       /* exits only */
  --ease-hover: cubic-bezier(0.25, 0.1, 0, 1);

  /* Travel — fixed distances, never element-relative */
  --travel-sm: 4px;
  --travel-md: 8px;
  --travel-lg: 16px;
}
```

Durations are tokens so a global "feels slow" fix is one edit, not fifty.

## Direction is derived, never hardcoded

This is the rule most likely to be broken by an agent applying a Latin recipe verbatim.

An entrance sliding "from the right" means *from the start* in Arabic and *from the end* in Latin. A
hardcoded positive `translateX` reverses meaning between directions. Every skill recipe that contains
`translateX` needs adapting before use.

Prefer logical properties, which handle this natively:

```css
/* WRONG — hardcoded physical direction */
.drawer { transform: translateX(100%); }

/* RIGHT — logical inset, direction-aware */
.drawer {
  inset-inline-start: 0;
  transform: translate(calc(-100% * var(--dir, 1)));
}
```

In Motion, derive the sign once:

```tsx
const dir = useDirection();          // 'rtl' | 'ltr'
const sign = dir === "rtl" ? -1 : 1;

<motion.div
  initial={{ x: sign * 16, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
/>
```

Vertical motion (`translateY`) is direction-neutral and needs no adaptation — which makes it the
safer default for entrances in a bidirectional product.

## Arabic text motion — what is unavailable

**Never animate `letter-spacing` on Arabic.** It severs the cursive joins and reads as misspelling.
Every Latin kinetic-typography technique that tweens tracking is unusable. See the RTL skill.

**Vertical stacked type is unavailable.** Arabic set vertically rotates along the line rather than
stacking one glyph per line, which breaks the join.

**Tatweel cannot animate.** The elongation in `فَسيلـة` is a character in the string with a fixed
width, authored by an Editor. Preserve it; do not attempt to animate it.

What *is* available for Arabic display motion:

| Technique | Mechanism | Notes |
|---|---|---|
| Weight morph | `font-variation-settings: "wght"` | Cairo offers 200–1000 — wide range |
| Slant | `"slnt"` axis | Cairo has one, unusual in Arabic faces |
| Per-word stagger | `transform` + `opacity` per word | Word-level is safe; letter-level is not |
| Kashida stretch | a custom font axis | **Only** with a licensed face that has one — see ADR 0009 |
| Clip reveal | `clip-path` along the inline axis | Direction-aware; reveals the join intact |

Per-word staggering is the workhorse. Splitting Arabic at word boundaries preserves every join;
splitting at letter boundaries destroys them. Any "split text" utility must be configured to
word granularity and never `chars`.

## Reduced motion

Every animation gets a reduced-motion path — including opacity fades. No exceptions.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Scroll-driven animation on the landing page must resolve to its **final state** under reduced
motion, not its initial one — a reader who prefers reduced motion still needs to see the content.

## Performance

Transform and opacity only. `filter: blur()` stays under 20px and is used sparingly — it is the one
expensive property the patterns legitimately call for, and it is worst on Safari.

Looping animations pause off-screen via `IntersectionObserver`.

Note the interaction with the colour system: the brand teal sits at 99% of the sRGB chroma ceiling,
so animating `opacity` or applying `filter` over a coloured ground **will clip it**. Cross-fade
between two full-strength tokens rather than fading a brand fill over a brand ground.

## Component recipes

The imported `animations/patterns.md` holds exact values for modals, drawers, popovers, tooltips,
toasts, icon swaps and press feedback. Use them, with two adaptations every time:

1. Replace hardcoded `translateX` with the direction-derived form above.
2. Replace raw ms values with the duration tokens.

## Landing page motion

Specified in [landing-motion.md](./landing-motion.md), produced by the `motion-brief` interview
process rather than assumed. See also ADR 0007 (why the marketing-page constraint is relaxed) and
ADR 0011 (native CSS scroll timelines, and the GPU layer budget).

## Review

Before any motion ships: does it need to animate at all given its frequency; transform/opacity only;
easing matches enter/move/hover; under 300ms with a faster exit; interruptible; origin-aware;
direction-derived rather than hardcoded; reduced-motion path present; and — for Arabic text — no
`letter-spacing`, no letter-level splitting, tatweel preserved.
