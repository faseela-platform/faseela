# Motion brief — landing page

Produced by the `motion-brief` skill process. Every field is filled; interview closed.

Decisions confirmed by Abdullah in round 3. Supersedes nothing in `docs/design/motion.md` — that
file governs product UI, this one governs the landing page only.

## Recon

| | |
|---|---|
| Component | Landing page, `apps/web`, not yet built |
| Two states | Unscrolled → scrolled (per section: pre-reveal → revealed) |
| Trigger | Scroll position, plus one first-run hero sequence on load |
| Stack | Next.js + Tailwind v4; `motion/react` available; **native CSS `animation-timeline` preferred** |
| Existing tokens | `--dur-*`, `--ease-*`, `--travel-*` in `docs/design/motion.md` |
| Reduced motion | Global handler specified in `docs/design/motion.md`, not yet implemented |

## Verdict

**Animate.** Fully scroll-driven — the page is a timeline.

## Purpose

Legitimacy first, recruitment second, explanation third. A visitor should conclude within seconds
that Faseela is a serious, well-run institution; then want to join a Track; then understand what it
does.

The motion carries what a static page cannot: that someone competent built this. For an initiative
whose audience already follows it on Instagram, the website's unique job is looking institutional in
a way a social feed cannot.

## Frequency

Seen once or twice per visitor, on first contact. This is what permits elaborate motion — the
`animations` skill reserves showy sequences for rare or first-run moments, and a landing page is
exactly that. **No product UI may inherit these patterns.**

## Register

Phenomenon Studio's *discipline* — transform-only, precise, nothing gratuitous — with an Arabic
institution's *tone*. Not Western tech-agency personality. The distinction is deliberate: Phenomenon's
craft is worth copying, its swagger would sit badly on a cultural initiative.

## The hero sequence

Three devices, choreographed as one sequence, on load. Total ~2.1s.

| Beat | Element | Motion | Timing |
|---|---|---|---|
| 1 | Gold ornamental border | Self-draws via `stroke-dasharray` | 0 → 900ms, `--ease-enter` |
| 2 | Wordmark `فَسيلـة` | `clip-path` reveal along the inline axis, start → end | 700 → 1500ms |
| 3 | Tagline | Per-word stagger, 70ms apart, `opacity` + `translateY(8px)` | 1400 → 2100ms |
| 3b | Tagline | `wght` morph 300 → 600 over the stagger | concurrent with 3 |

Beats overlap by ~200ms so the sequence reads as one movement rather than three.

The ornament is Faseela's own asset — a repeating leaf/seed border found beneath the wordmark in the
logo file, never yet used on screen. SVG stroke drawing is compositor-cheap and thematically exact:
a seedling growing.

The clip reveal is the only technique that touches Arabic glyphs not at all, so every cursive join
survives intact. **Tatweel in the wordmark is preserved as authored** and never animated.

## Enter (sections below the hero)

Scroll-linked, expressed in CSS:

```css
@supports (animation-timeline: view()) {
  .reveal {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 35%;
  }
  @keyframes reveal {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

`translateY` rather than `translateX` — vertical motion is direction-neutral and needs no RTL
adaptation. Where horizontal motion is used, the sign is derived, never hardcoded.

## Exit

None. Sections do not animate out on scroll-up; they hold their revealed state. Re-animating on
reverse scroll is the single most common scroll-driven annoyance and reads as instability — the
opposite of the legitimacy goal.

## Origin

Hero: ornament from its own start point; wordmark clip from the inline start (right, in Arabic).
Sections: no scaling, so no transform-origin concern.

## Easing and duration

Scroll-linked animations use `linear` — scroll position *is* the timeline, and any curve applied on
top fights the user's finger. Curves apply only to the load-triggered hero sequence, which uses
`--ease-enter` (`cubic-bezier(0.32, 0.72, 0, 1)`).

## Interrupt

Scroll-linked motion is inherently interruptible and reversible — it tracks position, not elapsed
time. The hero sequence is a one-shot `@keyframes` that runs to completion; it cannot be interrupted
because nothing can interrupt it (it fires before meaningful scroll is possible).

## Reduced motion

Content appears in its **final state instantly**. All travel, all scroll-linking, and the hero
sequence are removed. Opacity fades do not survive either — the skill is explicit that reduced means
reduced.

The architectural consequence, which is the real content of this decision: **the final state is the
source of truth, and motion is layered on top.** The page must be authored static-first. Building it
motion-first and treating static as a fallback produces the blank-page bug, where a reduced-motion
visitor sees nothing because elements are stuck at `opacity: 0`.

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; opacity: 1; transform: none; }
}
```

## Stack decision: native CSS, not a JS scroll library

**Native CSS `animation-timeline` is mandatory for scroll-linked motion.** `motion/react` may be used
for the hero sequence and for interactive components, but must not drive scroll.

Support as of June 2026 is **83.66%** — Chrome 115+, Edge 115+, **Safari 26+** (desktop and iOS),
**Firefox 156+**, Samsung Internet 23+.

The reason is the performance floor, not novelty: native scroll timelines run **off the main thread**.
A JS `scroll` listener fires 100+ times per second against a 16.6ms frame budget and starves the
paint thread. This is the entire mechanism behind "smooth on the developer's laptop, a slideshow on a
budget phone."

Fallback for Firefox Android and older browsers: `@supports` guards, degrading to the **static final
state** — deliberately not a JS polyfill, since the polyfill *is* the jank. This is the same code path
as reduced motion, so one fallback serves both.

## Performance floor and budget

Target: a mid-range Android on Lebanese mobile data.

Non-negotiable constraints:

- **`transform` and `opacity` only** for anything scroll-linked. Measured effect of getting this
  wrong: 42% dropped frames versus under 4% on a mid-range Snapdragon.
- **Under 10 promoted GPU layers on mobile.** GPU memory is finite on budget hardware; over-promotion
  causes layer explosion, which is slower than no promotion at all — one documented case went from
  18MB to 240MB of GPU memory.
- **`will-change` is applied via JS immediately before an animation and removed the moment it
  settles.** Static `will-change` in the stylesheet is forbidden.
- **`filter: blur()` under 20px**, used sparingly, and never on a brand-teal fill — the teal sits at
  99% of the sRGB chroma ceiling and clips under filters.
- **Looping and `wght` animations pause off-screen** via `IntersectionObserver`.

## Verification gate

Before the landing page merges:

1. Chrome DevTools Performance trace at **4× CPU throttling** during a full-page scroll.
2. **No purple Layout bars** during scroll. Composite-only.
3. Layers panel: **under 10** promoted tiles at any scroll position.
4. Reduced-motion pass: every section legible, nothing stuck invisible.
5. RTL pass: no element enters from the wrong side; no `letter-spacing` on Arabic.
6. Real mid-range Android before launch — emulation reproduces neither thermal throttling nor a weak
   GPU. Abdullah is in Lebanon and can test on target hardware.

Failing 1–5 blocks merge. Failing 6 blocks launch, not merge.

## Open risk

**`font-variation-settings` is not compositor-accelerated.** The browser re-interpolates glyph
outlines and re-rasterises them every frame. FontLab's guidance identifies the failure case as many
headings animating at once — "ten card heroes in a long scroll."

Our exposure is one short tagline, a handful of glyphs, once, on load. That should be well inside
budget, but it is the one number in this brief I have not measured on target hardware.

How we check: profile beat 3b in isolation at 4× throttling. If it costs frames, step the weight in
discrete stages instead of interpolating continuously; if it still costs frames, drop `wght` from the
stagger and keep `transform` + `opacity`. The sequence survives without it.

Related: ADR 0009 records that no free Arabic font has a kashida axis, so Cairo's `wght` and `slnt`
are the only variable-axis motion available. If 29LT Idris is licensed post-launch, a `Kashida` axis
becomes available and this brief gains a beat — but nothing here needs rewriting.
