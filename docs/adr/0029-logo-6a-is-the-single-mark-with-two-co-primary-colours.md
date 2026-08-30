# 29. Logo 6a is the single mark, with two co-primary colours

Date: 2026-08-29

## Status

Accepted. Revises ADR 0012's teal-led restraint (gold gains area and voice) and supersedes the
original Instagram logo as the source of the mark.

## Context

Until now the product never showed its mark — only the text wordmark — and used gold as a minor
accent under a teal-dominant system. The original logo (the Instagram PNG: a low wave-shaped book,
gold stem, teal leaves, long-tatweel wordmark) existed only as a raster; every vector we had was a
hand-traced interpretation.

The owner designed a new mark in their Claude Design project across six rounds and approved
**6a** («1a مع عروق الأوراق، كعب ذهبي متّصل بالساق، صفحات رفيعة تحت الغلاف، ولمسات واقعية خفيفة»):
a straight-cover open book with a thin paper block beneath, a gold stem that continues down as the
spine, two teal leaves with a vein highlight, a teal gradient `#1ecfae→#0e9b82` and a gold gradient
`#e3bd4e→#b18f2f`, a soft ground shadow, and the wordmark فسيلـــة in Cairo 700 gold.

Two decisions were needed: which mark is _the_ mark, and how much room gold gets.

## Decision

**6a is the single brand mark, everywhere.** Web nav and hero, `icon.svg` / `apple-icon` /
`opengraph-image`, the Expo icon, adaptive icon and splash, and the social exports. The original
PNG is retired; it is not kept as a fallback or a "classic" variant. The owner re-posts the new mark
on Instagram the week the site ships, so the 17k followers see one mark, not two.

**Geometry lives in one file:** `packages/tokens/brand.ts` (M/L/C/Z only, viewBox
240×230, spine base at (120, 202)). `apps/web/app/(site)/components/mark.tsx`, the WebGL geometry,
the Lottie generator and `scripts/brand/render.mjs` all read it. A change to the mark is a change
to that file, then a re-render; no consumer holds a copy.

**Rasters are rendered with Chromium, not Satori.** `next/og`'s Satori does not shape Arabic, so the
wordmark would render disconnected. `scripts/brand/render.mjs` (Playwright) produces every PNG with
real Cairo shaping; `opengraph-image.png` and `apple-icon.png` are static files, not `ImageResponse`
routes.

**Gold is a co-primary.** `--accent` (stem gold) carries the wordmark, ordinals, points, tiers,
badges and highlights; `--brand` (seedling teal) keeps structure, actions, links and progress. The
mark's own gradients enter the token system as `--teal-hi/lo` and `--gold-hi/lo` (T2). Gold _text_
on paper uses the low stop or stem-500 — the high stop is for display sizes and fills only.

**Sizes.** Below ~32 px the paper edge, sheen, page lines and veins turn to mush; `icon.svg` and the
`mono` variant drop them. The mono variant (`currentColor`) serves favicons on dark tabs, Android's
monochrome icon, stamps and loading states.

## Consequences

- One mark, one file, one render script: brand drift becomes a diff, not a hunt.
- The hero's 3D geometry and the grow animation are exact derivatives of the approved shape — no
  "interpretation" sign-off is needed again.
- ADR 0012's rubric (restraint, hard alignment, hairline lattice, recessive ordinals) stays; what
  changes is _which colour_ carries emphasis. ADR 0012 is revised separately for radii and cards.
- The Instagram profile and any printed material must be updated by the initiative; the platform
  provides the exports in `assets/brand/exports/`.
