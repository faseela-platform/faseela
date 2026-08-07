# 0020 — Scroll reveals use the `entry-crossing` range, and reveals are verified by measuring opacity

Status: accepted
Date: 2026-08-07
Supersedes part of: [0011](./0011-motion-is-css-scroll-driven-not-javascript.md)

## Context

ADR 0011 committed the site to native CSS scroll-driven animation — `animation-timeline: view()`
with no JavaScript, so reveals run off the main thread and stay smooth on a mid-range Android on a
Lebanese mobile connection. That decision stands. This ADR records how the _range_ must be
expressed, because the first two answers were wrong in production and the failure mode is severe.

The Tracks index seeded three published Tracks. It rendered three `<li>` elements in the HTML and
displayed **one**. The other two sat at `opacity: 0` and `opacity: 0.11` permanently, no matter how
the reader scrolled.

`animation-fill-mode: both` is load-bearing for the static-first approach: it holds an element at
its final state after the animation completes. But it equally holds an element at whatever progress
it reached if the animation _never_ completes. A reveal that cannot finish is therefore not a
degraded animation — it is invisible content, indistinguishable from a rendering bug or missing data.

Two attempts failed:

1. **`entry X% cover Y%`.** The `cover` range measures the element's progress _through_ the
   scrollport, so completing it requires substantial scrollable content after the element. The tall
   landing page always had that. A three-cell index page did not, so the last cell froze at zero.

2. **`entry X% entry 100%`.** `entry 100%` means the element is _fully inside_ the scrollport. A
   lattice cell is `--cell-min-h` = 22rem = 352px. On a 390×844 phone, minus browser chrome, a cell
   of that height can barely ever be fully inside the viewport, so the range still could not
   complete. This attempt looked correct and was committed to the working tree before measurement
   caught it.

## Decision

**All scroll-driven reveal ranges are expressed in the `entry-crossing` phase, and all end well
before 100%.**

`entry-crossing` measures the element's leading edge crossing the scrollport's leading edge. It is
independent of both the element's height and the amount of document remaining after it — the two
variables that broke the previous attempts. Ending at 55–65% means the reveal completes once the
element is a little past halfway in, which is reachable for an element taller than the viewport on a
page with nothing after it.

Stagger offsets are capped (`min(var(--i), 3)`) and the range _end_ is a fixed percentage rather
than offset per child. An offset end is what makes the final item of a long list unreachable.

**Corollary: any element whose height approaches the scrollport's must not use the `entry` or
`cover` phases.** In practice this means all of them, since `--cell-min-h` exists precisely to make
cells tall.

## Consequence: reveals must be verified by measuring opacity, not by reading markup

No structural check could have caught this. The markup was perfect — correct elements, correct
Arabic, correct order, valid CSS, no console error. Every existing assertion passed while the page
showed one Track of three.

`scripts/shoot-tracks.mjs` therefore measures computed `opacity` on every `.reveal*` element and
fails the check if any is below 0.9.

**The harness itself was wrong first, and this is the more important lesson.** Its initial version
scrolled to the bottom of the page, scrolled back to the top for a tidy screenshot, and then
measured. But `view()` timelines are scroll-position-linked, not one-shot: scrolling away from an
element _rewinds_ its animation. The harness was measuring rewound animations and reporting healthy
cells as stuck at zero. Its false failures sent us to change CSS that was already correct.

A check that fails on correct code is not a safe error. It is worse than no check, because it
invites edits to working code — and we made two.

The harness now scrolls each element into view individually and measures it there, which is the
condition a reader actually experiences. It was validated by reverting the CSS to the original
`cover`-phase range and confirming the harness reports the defect, then restoring the fix and
confirming it passes. **A regression check that has never been observed to fail is an assumption,
not a check.**

## Alternatives rejected

**A JavaScript `IntersectionObserver` stagger.** Reliable and range-free, but it puts the site's
first client bundle on every page to animate a list, and reintroduces main-thread work that ADR 0011
exists to avoid.

**Dropping the stagger.** Would have removed the bug and the choreography with it.

**A smaller `--cell-min-h`.** Treats a symptom. The bug is a range that cannot complete; a shorter
cell only moves the threshold at which it reappears, and the next tall element brings it back.
