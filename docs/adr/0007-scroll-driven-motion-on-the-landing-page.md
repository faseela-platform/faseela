---
status: accepted
date: 2026-08-06
---

# The landing page relaxes the marketing-pages ban on scroll-driven motion

The imported `marketing-pages` skill states that scroll-triggered animation should not be used, and that intro animations run once per session. The landing page deliberately relaxes the first half of that rule: it uses scroll-driven kinetic Arabic typography as its primary device. This ADR exists so that a future reader — or agent — finds a recorded decision rather than an apparent violation, and so the relaxation stays bounded.

## What the rule is protecting against

The skill's target is content that cannot be read until it has finished animating, layout that shifts as the reader scrolls, and motion that exists to demonstrate that motion is possible. Those failures are real and the ban prevents all of them cheaply. The Initiative's requirement, however, is explicit: the landing page must reach the standard of studio work where disciplined scroll choreography is the medium. Meeting that bar while obeying the letter of the rule is not possible.

## The bounded relaxation

Scroll-driven motion is permitted on the landing page only, and only within these limits, which are the conditions that make the original ban unnecessary rather than merely overridden:

Content is fully present and readable in the DOM before any motion runs, so the page is legible with JavaScript disabled and to a crawler. Motion animates `transform` and `opacity` only, never a property that triggers layout. Nothing reserves space it does not already occupy, so cumulative layout shift stays at zero. `prefers-reduced-motion` resolves to the finished state immediately rather than a shortened animation. Kinetic typography operates on kashida stretching and optical scale — devices native to Arabic letterforms — rather than on Latin-derived letter-spacing tricks.

Everywhere else in the product — the Feed, Tracks, Tasks, the admin — the skill's rule stands unrelaxed. Motion there is interface feedback, and `interface-animations` governs it.

## Consequences

The landing page carries a review gate the rest of the product does not: `review-animations` plus a measured check that layout shift is zero and that the reduced-motion path is complete rather than degraded. If that gate cannot be met, the choreography is cut rather than shipped, because the Initiative's audience reaches this page on mid-range Android phones over Lebanese mobile networks, and a landing page that is beautiful on a MacBook and unusable on a Galaxy A-series has failed at its actual job.
