# 33. The grow intro is a morning, not a UI

Date: 2026-09-01

## Status

Accepted. Revises the T1b choreography (the CSS grow intro); ADR 0011 (CSS-only
motion) is deliberately UNCHANGED — the owner evaluated Rive, GSAP/WAAPI and a
shader-grown R3F mark and chose to re-choreograph within CSS first.

## Context

A deterministic filmstrip (`.scratch/grow-filmstrip.mjs`, pause + seek every
document animation) named four defects in the 2.2 s intro: (1) the ring and all
three loop chips were on stage at t=0, narrating a mark that did not exist yet;
(2) ~600–900 ms of dead air while the book's 6 px settle had finished and the
stem's first stretch drew invisibly along the spine; (3) `--ease-out-expo` on
the stem front-loaded the draw — full height in ~300 ms, then a stall, leaving a
bare stick standing before the first leaf at 1150 ms; (4) leaves entered with a
generic opacity+scale pop, and every layer shared the same UI easing.

## Decision

Owner (2026-09-01): calm and organic, ≈3 s, cinematic order, replay every load
(unchanged from 2026-08-30). The new timeline: light first (glow disc and
sun/moon breathe in, the ring after), the book rises into it with real travel,
the stem grows near-linearly for 1.4 s with a hair of sway (`rotate` on the stem
group), each leaf unfurls from its node with a small overshoot while the stem is
still climbing, the veins surface and the ground shadow _spreads_ (scaleX) under
the finished plant — and only then the three chips step in, staggered 200 ms
apart. Each act carries its own easing; `--ease-out-expo` no longer appears in
the intro. Chips are now two elements each (entrance on the wrapper, ambient
float on the card) because one element cannot run both animations without the
entrance clobbering the float's negative phase delay; for the same reason the
ring's fade-in is composed into one `animation` list with its 60 s spin. The
WebGL swap guard moved from 2.6 s to 3.8 s so the scene can never cut the intro.

## Consequences

Reduced motion still renders the final frame outright (all keyframes stay behind
`prefers-reduced-motion: no-preference`, entrance fills included). The mobile
Lottie splash still carries the OLD choreography — `scripts/brand/make-lottie.mjs`
should be regenerated to match in a follow-up if the owner wants parity. A
future escalation path (Rive single-asset, or growing the WebGL mark itself via
a clip uniform) remains open and would revise ADR 0011/0028 explicitly.
