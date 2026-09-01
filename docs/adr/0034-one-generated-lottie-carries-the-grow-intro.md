# 34. One generated Lottie carries the grow intro

Date: 2026-09-01

## Status

Accepted. Revises ADR 0011 (CSS-only site motion) for exactly one bounded case, and
supersedes ADR 0033's CSS choreography as the _primary_ intro (it remains the fallback).

## Context

The re-choreographed CSS intro (ADR 0033) still read soft: the mark's layers sit under
`perspective` + `translateZ`, and browsers rasterize composited layers into scaled GPU
textures — the animation could never be as crisp as the resting mark. The stem also drew
from the path's foot, poking a stub below the hardcover. The owner chose to refactor the
technology; of the candidates (Rive — needs GUI authoring; GSAP — web-only; shader growth
in R3F — gated devices only) the owner picked **one generated Lottie for both platforms**.

## Decision

- `scripts/brand/make-lottie.mjs` is THE intro source: brand geometry (ADR 0029) plus the
  ADR 0033 timeline, with per-act bezier easings, leaf unfurls with overshoot and rotation,
  stem sway, a spreading (scaleX) ground shadow — and the stem split into two layers:
  the **spine rides in with the book** (a static trim, part of the book's rise) while the
  **growth layer's trim starts at the spine fraction (~52%)**, so nothing can ever draw
  up from the foot. Output: `apps/native/assets/brand/grow.json` (splash) and
  `apps/web/public/brand/grow.json` (landing), ~10 KB.
- Web: `hero-scene/grow-intro.tsx` plays it with **lottie-web light, SVG renderer** (async
  chunk ~45 KB gz — outside the 25 KB page-own budget by design; ADR 0028's ledger gains an
  "intro chunk" line). Contract via a pre-paint attribute from `theme-script.tsx`:
  `html[data-grow="js"]` stands the CSS intro down and hides the mark layers;
  `"done"` (completion, or a 2.5 s bail on slow lines) crossfades the interactive mark in.
  **No JS or reduced motion → attribute absent → the ADR 0033 CSS intro (or its static
  frame) runs unchanged as the fallback.** The overlay lives inside `.hero-float`, so the
  growing mark bobs and tilts with the ring and chips.
- Mobile: the splash consumes the same regenerated file (fail-safe timer 3.6 s).

## Consequences

One choreography, authored in code, identical on web and phone; every future timing note
is a one-file edit plus `node scripts/brand/make-lottie.mjs`. ADR 0011 now reads: site
motion is CSS **except the brand intro**, which is a generated Lottie played by a lazily
loaded runtime. If the intro ever needs interactivity (states, cursor response), Rive is
the named escalation and would repeat this ADR's shape.
