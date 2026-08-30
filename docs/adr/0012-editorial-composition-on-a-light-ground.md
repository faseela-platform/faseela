# 12. Editorial composition on a light ground

Date: 2026-08-07

## Status

Accepted; **revised 2026-08-29 (Slice 9, ADR 0029, owner decisions D1/D5/D7)**.

What changes: the ground is **light by default with a night theme** the visitor can toggle
(`data-theme="dark"`, set before first paint); **raised cards with soft elevation and 12/16 px
radii** are allowed on the landing (steps, the stations card, the hero chips) and on product
surfaces — "hairlines, not cards" no longer binds the marketing page; **gold is a co-primary**
carrying the wordmark, ordinals, points and tiers, while teal keeps structure and actions; and the
landing's composition is the owner's design (`assets/design/faseela-landing.dc.html`), not the
Phenomenon Studio rubric.

What stays: hard alignment to the start margin (the one centred block is the closing invitation,
which has nothing to align to), restraint in type size, ordinals recessive relative to their
content, one primary action per view, and directional glyphs avoided under RTL. The rubric in
`docs/design/reference.md` is now guidance for product pages rather than the landing's contract.

## Context

The first landing page pass was built to the design system but not to any reference. Measuring the
agreed reference site ([Phenomenon Studio](https://phenomenonstudio.com/)) with
`scripts/capture-reference.mjs` showed the first pass had inverted most of its defining properties:
hero type roughly twice as large, at weight 700 against their 440, everything centre-aligned against
their hard left margin, body type at 16px against their 23px, and section padding at 96px against
their 200px. The display-to-body ratio was ~8x where theirs is 2.96x.

The reference also derives much of its character from a near-black ground with a single saturated
accent. Adopting that directly conflicts with two established facts: the brand identity is measured
as ink on `#f2f2f2` paper (`docs/design/color.md`), and the brand teal fails APCA on a dark ground —
`seedling-500` lands at Lc 35.8, below even the large-text floor of 45, which is why dark mode has
to remap brand roles to steps 100-200.

Three options were considered: stay light and take the reference's compositional qualities; go dark
and match the reference closely; or alternate dark and light bands.

## Decision

Adopt the reference's **compositional** rules on a **light** ground.

The qualities that produce the impression of quality are independent of ground colour, and are now
recorded as a seven-rule rubric in `docs/design/reference.md`: restraint over size, hard-alignment to
the margin rather than centring, letting the next section intrude at the fold instead of leaving dead
space, hairline rules instead of cards, content pinned to opposite edges of tall cells, recessive
ordinals, and a scroll-linked sense of position.

Three tokens are added to support this: `--text-lede` (20px, the Arabic counterpart of the
reference's 23px body), `--section-y` / `--section-y-sm` for section rhythm, `--cell-min-h` for tall
grid cells, plus `--hairline` and `--ink-faint` roles.

Under `dir="rtl"` the reference's left-alignment becomes right-alignment. This is expressed with
logical properties (`text-align: start`, `padding-inline`, `margin-inline`) so the mirroring is
automatic rather than a second set of rules.

## Consequences

The page will read as editorial rather than as a component gallery, and the visible amateur tells —
a centred hero floating in dead space, rounded cards in a grid, bright ordinals outshouting their own
content — are removed.

Brand fidelity is preserved. The teal continues to be used where it passes contrast, and no accent
has to be abandoned or substituted for the marketing surface.

The page is further from the reference than a dark version would be. Direct visual comparison against
the reference will always show a difference in mood; the rubric, not the screenshot, is what
compliance is judged against.

Cards are now forbidden on the marketing surface, which constrains future sections: any new block
must be composed with rules and space rather than reached for as a boxed component. Product surfaces
inside the app are not bound by this — a Task list legitimately wants an enclosing container.

Two of the reference's devices are deliberately not adopted. Fully square button corners read as
severe for a youth-facing initiative, so a small radius is kept. And the reference's trailing `→` on
CTAs is directional: under RTL it would need to become `←`, and an arrow pointing the wrong way is
worse than no arrow, so directional glyphs are avoided unless implemented with logical awareness.
