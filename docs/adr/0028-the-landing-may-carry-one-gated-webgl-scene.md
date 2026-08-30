# 28. The landing may carry one gated WebGL scene

Date: 2026-08-29

## Status

Accepted. Revises ADR 0011 (the landing is no longer zero-JS; see its revised status) and records
the hero-scene decision from the T-A comparison.

## Context

The owner's landing design (ADR 0029) puts the mark at the centre of the hero as a floating,
tilting 3D object. A layered CSS-3D rendering of the SVG gets most of the way — three copies of
the mark at different `translateZ` depths, a pointer tilt, a float. What it cannot do is _light_
the mark: no bevelled edges catching a highlight, no gold that reads as metal, no depth inside the
shape. The owner chose a real WebGL scene for that (MCQ, 2026-08-25), and after seeing three
candidate scenes on a canvas chose the ground under it: **A — «الكتاب يفتح الأرض»**, terraces
that are the cover's own curve repeated outward from the spine (2026-08-29).

The tension is the performance floor — a mid-range Android on Lebanese mobile data — which ADR
0011 protected by shipping the landing with no JavaScript at all. three.js is ~150 KB gzipped and
does not tree-shake meaningfully; its parse cost alone stalls a 2 GB phone.

## Decision

**The CSS-3D mark is the contract. The WebGL mark is an upgrade some devices earn.**

1. **Server HTML = the CSS-3D mark** (`hero-scene/mark-3d.tsx`): the layered SVG with float,
   tilt, the orbit ring, the loop chips, the land (`land.tsx`, terraces derived from the mark's
   own geometry), the sun/moon and stars. This is what every visitor gets, and it is complete —
   the page is verified in this state (`pnpm verify:page /`).
2. **A pure capability gate** (`apps/web/lib/hero-gate.ts`, unit-tested) decides, in this order:
   reduced motion → no; Save-Data → no; no WebGL2 → no; `deviceMemory` reported and
   ≤ 2 GB → no; `hardwareConcurrency` ≤ 6 → no; otherwise yes. `#webgl` in the URL forces
   yes and `#noscene` forces no — for verification and audits only, because neither
   headless Chromium nor a desktop running Lighthouse is the phone the floor is set for
   (Lighthouse no longer marks its user agent, so it cannot be recognised). The default is no. The core threshold was raised from 4 to 6
   after Lighthouse's 4×-throttled mobile profile spent 3.5 s of main thread parsing the
   chunk: the parse cost, not the frame rate, is what a mid-range phone cannot afford.
3. **Loading order**: never before `load`, never before the grow intro has finished, only from
   `requestIdleCallback`, and only while the hero is on screen. The chunk is a `next/dynamic`
   import declared in the client island (`ssr: false` is only legal there). It is never
   preloaded.
4. **Runtime budget** (`scene-canvas.tsx`): `frameloop="demand"` — the scene renders only while a
   pointer/scroll target is still being approached, then stops; `dpr ≤ 1.5`; no shadows, no
   post-processing, no environment map; ≤ 10 k triangles (`curveSegments: 8`, `bevelSegments: 2`);
   an orthographic camera framing the viewBox exactly so the canvas overlays the CSS mark
   pixel-for-pixel; the canvas is `aria-hidden` and `pointer-events: none`.
5. **Self-check and retreat**: the first two seconds are rendered continuously and counted; under
   ~28 fps the scene unmounts. `webglcontextlost` unmounts it. Reduced motion switching on
   mid-session unmounts it. In every case the CSS mark is still there underneath — the visitor
   never sees an error, a blank, or a jump.
6. **One source of geometry**: `mark-geometry.ts` builds the meshes from the same path strings
   the SVG draws (`@faseela/tokens/brand`), via `SVGLoader` → `ExtrudeGeometry`, and the stem
   as a `TubeGeometry` along its own curve. The 3D mark cannot drift from the 2D one.
7. **Budgets, as measured on the production build (2026-08-30, `next start`, transfer size):**
   the ungated `/` ships **154 KB gzipped** of JavaScript in total, of which ~115 KB is the
   Next/React runtime every route pays and **~24 KB is this page's own code** (islands + the
   page chunk). The ceiling for the page's own code is **25 KB gzipped**. The WebGL chunk
   (three 0.185 + R3F + SVGLoader + geometry) measured **238 KB gzipped**, over the 200 KB
   figure the plan assumed; it is accepted at **≤ 240 KB** because it is idle-loaded, on-screen
   only and behind the gate, with one known reduction on the follow-up list: replace
   `SVGLoader` (~40 KB) with the repo's own cubic-path → `Shape` converter (the Lottie generator
   already parses the same M/L/C/Z grammar).
8. **The scene must read as the logo, not as a cut-out (2026-08-30, after the owner's review of
   the first render).** What changed and why, each measured on the production page:
   - _Framing_: the canvas box is a percentage of the mark's **stage** (460 px), not of the hero
     column — measured against the column it rendered a third larger and sat on the third chip.
   - _No tone mapping_: R3F's default ACES filmic darkened and desaturated the teal into a colour
     that was not the token. Brand colours must reach the screen as authored.
   - _Gradients as vertex colours_ (`paintGradient`): the SVG's per-element vertical gradient,
     painted over each part's own bounding box; the material colour is white.
   - _Environment map, not key lights_: `RoomEnvironment` through PMREM; exposure is set with
     `scene.environmentIntensity` (a material's `envMapIntensity` does not scale a scene-level
     environment — measured, not assumed) plus a hemisphere fill, tuned by sampling the rendered
     cover against the CSS mark until they matched (`#36b59a` vs `#16b598`; night `#3ecaad` vs
     `#26cdae`).
   - _Flat unlit strokes_ (`SVGLoader.pointsToStroke`, `MeshBasicMaterial`) for page lines and
     veins; as lit tubes they read as plumbing.
   - _The land (terraces) was removed_ by the owner: eye-straining, took the hero's vertical
     space, and never cohered with the mark. The stage is the glow, the ring, the mark with its
     ground shadow, the chips, and the sun/moon centred above the book.
   - `window.__heroScene` is exposed under `#webgl` only, so the smoke script can inspect the
     graph (lights, materials, environment) instead of guessing from pixels.
9. **Lighthouse, mobile profile, 4× CPU throttle, production build (2026-08-30):** the fallback
   path (`/#noscene`) scores **92 performance** (TBT 150 ms, CLS 0, LCP 3.1 s, accessibility
   100); the WebGL path (`/#webgl`) scores 66 (TBT 1.3 s) on that same profile — which is the
   measurement the gate exists for: a device that throttled is never offered the scene. The
   fallback path is the number the DoD holds; the scene is audited for regressions, not for a
   score.

Pinned: `three@0.185.1`, `@types/three@0.185.4`, `@react-three/fiber@^9.7.0`. No drei (a second
addons copy, not in `optimizePackageImports`), no v10 alpha.

## Consequences

- The landing is verified twice: the fallback (deterministic, headless) and the WebGL path
  (smoke: canvas mounted with `#webgl`, no console errors, no long tasks). Headless Chromium
  renders WebGL through SwiftShader, so the WebGL path is never pixel-diffed.
- Colour under WebGL lighting is not the token: a lit teal is darker in shadow and lighter in
  highlight. Materials take the token hex; what the eye sees is the material _under light_,
  which is the point.
- The mobile app does not get the scene (R3F-native would ship a full three runtime under Hermes
  for a screen it does not have); its branded moment is the grow Lottie (T1b).
- The 3D mark models the page lines and leaf veins as thin tubes (`mark-geometry.ts`), so the
  cross-fade from the SVG drops nothing; only the SVG's gradients flatten to lit material.
- The scene reads scroll progress through a passive listener on the hero (a target the frame
  loop eases toward, never layout). This is the one scroll read ADR 0011 (revised) permits, and
  it exists only while the hero intersects the viewport.
