# Identity — the mark, and how it is used

The mark is **logo 6a** (ADR 0029): an open book with a thin paper block beneath, a gold stem that
runs down as the spine, and two teal leaves. It was designed by the owner in their Claude Design
project and approved on 2026-08-28; the platform holds it as geometry, not as a picture.

## Where the truth lives

| What                                           | Where                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Geometry (paths, colours, strokes, key points) | `packages/tokens/brand.ts`                                                             |
| Web component                                  | `apps/web/app/(site)/components/mark.tsx` — `<Mark size mono shadow idPrefix title />` |
| Browser tab                                    | `apps/web/app/icon.svg` (simplified: no shadow, sheen or veins)                        |
| Apple touch icon, Open Graph                   | `apps/web/app/apple-icon.png`, `apps/web/app/opengraph-image.png` (+ `.alt.txt`)       |
| Expo icon, adaptive icon, splash, favicon      | `apps/native/assets/images/*.png`                                                      |
| Social / print exports                         | `../assets/brand/exports/*.png` (1080²: mark, light, night, profile)                   |
| The original approved SVG                      | `../assets/brand/logo-6a.svg` (reference only — consumers read the paths file)         |

Re-render every raster with `node scripts/brand/render.mjs` (`web` / `native` / `social` to limit
it). It uses Chromium so the Cairo wordmark is shaped correctly; never generate the OG image with
`next/og`.

## Anatomy

Layers, in drawing order, each a `<g data-layer>` in the component so the CSS-3D hero and the grow
animation can address them:

1. `shadow` — ground ellipse at y=216 + a soft drop shadow (off for icons and 3D layers).
2. `paper` — the paper block under the covers, with a hairline.
3. `covers` — the two covers, teal gradient, with a faint white sheen on their top edge.
4. `lines` — three page lines per cover, paper-coloured at 70%.
5. `stem` — one gold stroke from the paper's foot (y=204) through the spine to the tip (118, 44).
6. `leaves` — two teal leaves, lower (left) and upper (right).
7. `veins` — a pale highlight on each leaf.

Key points: spine base **(120, 202)** — the origin of the seedling and, in the hero, of the land;
stem tip **(118, 44)**; viewBox **240 × 230**.

## Colour

| Role                    | Light               | Night               | Used for                                   |
| ----------------------- | ------------------- | ------------------- | ------------------------------------------ |
| `--teal-hi → --teal-lo` | `#1ecfae → #0e9b82` | `#35e2c2 → #14b899` | covers, leaves, primary CTA gradient       |
| `--gold-hi → --gold-lo` | `#e3bd4e → #b18f2f` | `#ecd08a → #c7a958` | stem, wordmark, highlights                 |
| `--brand`               | seedling-500        | seedling-200        | structure, actions, links, progress        |
| `--accent`              | stem-500            | stem-200            | gold at display size: ordinals, hero stats |
| `--accent-ink`          | stem-600            | stem-200            | gold as small text: points, tiers, badges  |

Gold text on paper: use `--accent-ink` (stem-600); `--accent` only at display size; never `--gold-hi` below
display size — it fails body-text contrast. The teal sits at the sRGB chroma ceiling; never
composite it under opacity or a filter (`docs/design/color.md`).

## Sizes and variants

- **≥ 48 px** — full mark (`<Mark />`).
- **32–48 px** — full mark without shadow (`shadow={false}`), as in the nav at 36 px.
- **≤ 32 px** — `icon.svg` / `mono`: no paper hairline, sheen or veins; strokes thickened.
- **Mono** (`mono`) — everything in `currentColor`; page lines in `--surface`. For dark tabs,
  Android monochrome, stamps, loading states.

Clear space: at least the stem's width above and the paper block's height below; never crop the
leaves. Never mirror the mark — the leaves' handedness is part of it. Never rotate it in UI; the
hero tilts it in 3D, which is the one sanctioned exception.

## Wordmark

Always live text — **فسيلـــة** in Cairo 700 with the authored tatweel — never an outlined path and
never letter-spaced (letter-spacing severs Arabic joins). Gold via `background-clip: text` from
`--gold-hi` to `--gold-lo`. The mark sits at the wordmark's start (its right, under `dir="rtl"`),
gap 10–12 px, optically aligned to the x-height band.

## The grow animation (T1b)

Authored once as keyframes on the layers above: the stem draws upward (`stroke-dashoffset`), the
leaves unfurl from their base (`transform-box: fill-box`, scale 0.6→1, staggered), the covers
settle, the shadow fades in — about 1.6 s, `--ease-out-expo`, once per session, final frame under
reduced motion. Exported as a Lottie for the app splash and as MP4/WebM/GIF for social.
