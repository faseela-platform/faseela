# 11. Scroll-driven motion uses native CSS timelines, never a JS scroll library

Date: 2026-08-07

## Status

Accepted.

## Context

The landing page is fully scroll-driven — the page is a timeline (round 3, B7 = C). The performance
floor is a mid-range Android on Lebanese mobile data (B9 = B). Those two decisions are in tension,
and the tension is resolved by *how* the scroll motion is implemented rather than by reducing it.

The conventional approach is a JS scroll library — GSAP ScrollTrigger, Locomotive, or Motion's
`useScroll`. All of them compute animation progress on the main thread in response to scroll events.
Against a 16.6ms frame budget at 60Hz, a listener firing 100+ times per second starves the paint
thread. This is the documented mechanism behind scroll motion that is smooth on a developer's laptop
and a slideshow on a budget phone; one audit measured 42% dropped frames on a mid-range Snapdragon
versus under 4% after moving to compositor-only properties.

Native CSS scroll-driven animations (`animation-timeline: scroll()` and `view()`) run **off the main
thread**. When we first considered this, browser support was the blocker — Safari in particular. That
is no longer true. Per caniuse using June 2026 usage data, `animation-timeline: scroll()` has
**83.66% global support**: Chrome 115+, Edge 115+, Safari 26+ (desktop and iOS), Firefox 156+,
Samsung Internet 23+. The remaining gaps are Firefox for Android and low-end browsers such as UC and
QQ, a small slice of a Lebanese audience.

## Decision

Scroll-linked motion is expressed in **native CSS** `animation-timeline`. No JavaScript scroll
listener may drive layout or animation progress.

`motion/react` remains available and is the right tool for the load-triggered hero sequence, for
interactive components, and for gesture-driven product UI. It must not be used for scroll.

Where the API is unsupported, `@supports (animation-timeline: view())` guards degrade the page to its
**static final state**. Explicitly not a JS polyfill — the polyfill reintroduces exactly the
main-thread cost the decision exists to avoid. Because that fallback path is identical to the
reduced-motion path, one implementation serves both.

Three hard budgets accompany this, enforced at review:

1. `transform` and `opacity` only for anything scroll-linked.
2. Under 10 promoted GPU layers on mobile. Over-promotion causes layer explosion, which is slower
   than no promotion — one documented case inflated GPU memory from 18MB to 240MB.
3. `will-change` applied via JS immediately before an animation and removed when it settles. Static
   `will-change` in a stylesheet is forbidden.

Verification is a Performance trace at 4× CPU throttling showing Composite-only work during scroll,
plus a real mid-range Android check before launch.

## Consequences

The landing page can be fully scroll-driven without betraying the performance floor, which is what
makes B7 = C and B9 = B compatible rather than contradictory.

The cost is expressiveness. Native scroll timelines cannot do everything a JS library can — no
scroll-hijacking, no pinned horizontal galleries with arbitrary easing per element, no reading scroll
velocity. Any design idea that requires those is out of scope, and the art direction has to be
authored within the API's grammar rather than adapted to it afterwards. This is a real constraint on
the landing page's design, accepted deliberately.

Authoring order is also constrained: the static final state must be the source of truth, with motion
layered on top. Building motion-first produces the blank-page failure, where unsupported browsers and
reduced-motion visitors see elements stranded at `opacity: 0`.

A residual risk sits outside this decision's protection. `font-variation-settings` animation — used
for the hero tagline's weight morph — is not compositor-accelerated; the browser re-rasterises glyph
outlines every frame. It is confined to one short element, paused off-screen, and must be profiled on
target hardware. If it costs frames, the weight morph is dropped and the sequence survives on
`transform` and `opacity`.

## References

- https://caniuse.com/mdn-css_properties_animation-timeline_scroll
- https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/
- https://blog.fontlab.com/2026/02/03/animating-font-variation-settings/
