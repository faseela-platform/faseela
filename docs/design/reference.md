# Reference rubric

The quality bar for the marketing surface, expressed as measurements rather than adjectives.
Reproduce with `node scripts/capture-reference.mjs <url> <label>`; raw output lands in
`.scratch/reference/<label>-measured.json`.

Reference: [Phenomenon Studio](https://phenomenonstudio.com/), captured at 1440x900.

## Measured

| Property | Reference | Faseela target | Note |
|---|---|---|---|
| Hero display size | 68px | `clamp(2.5rem, 6.5vw, 4.5rem)` = 40-72px | matched |
| Body / lede size | 23px | 20px (`--text-lede`) | Arabic reads larger per px |
| Display-to-body ratio | 2.96x | ~3.4x | close; deliberately not 8x |
| Hero font weight | 440 | 500 | restraint, not bold |
| Section vertical padding | 200px | 160px (`--section-y`) | lighter page, less dense |
| Alignment | hard left, ragged right | hard **right**, ragged left | RTL mirror |
| Background | near-black `#0a0a0a` | light `paper-50` | see "Departures" |
| Distinct type sizes | 6 | 6-7 | matched |

## The seven structural rules

These are what actually produce the quality impression. They are worth more than any single number.

**1. Scale comes from restraint, not size.** The reference hero is 68px at weight 440 — roughly half
the size of a naive "big hero" and much lighter. The impression of scale is produced by a long line,
tight leading, and the absence of competing weight. A 128px bold heading reads as amateur, not
confident.

**2. Hard-align to the margin. Never centre a hero.** Centred type reads as a template. The
reference aligns everything to a left margin with a ragged right edge. Under `dir="rtl"` this
inverts: hard-align right, ragged left. Use logical properties (`text-align: start`) so this is
automatic.

**3. Let the next section intrude at the fold.** The reference hero is not vertically centred in the
viewport and does not fill it. Content begins ~200px down and the following section is already
partly visible. That partial visibility is the scroll affordance — it does the job a scroll-hint
arrow pretends to do. Dead space above and below a centred hero is the most visible amateur tell.

**4. Define cells with hairlines, not cards.** No `border-radius`, no background fill, no box
shadow. A 1px rule at `--hairline` separates grid cells. A card says "component"; a rule says
"editorial".

**5. Pin content to opposite edges of a tall cell.** The ordinal sits at the top of the cell, the
title and body at the bottom, with a large void between (`--cell-min-h` = 22rem). That deliberate
emptiness inside the cell is where the sense of luxury comes from. Compressing content into a tight
block destroys it.

**6. Ordinals are large but recessive.** Index numerals are big and dim (`--ink-faint`), never the
brightest element. Making them the accent colour inverts the hierarchy and pulls the eye away from
the content.

**7. Give the reader a sense of position.** The reference uses a sticky rail whose active item is
bright while the rest are dim, driven by scroll position. On a long page this replaces a progress
bar with something that carries meaning.

## Departures, and why

**Light ground instead of near-black.** The reference's dark ground is central to its effect, but
Faseela's measured identity is ink on `#f2f2f2` paper, and the brand teal is a light-ground colour:
on a dark ground `seedling-500` lands at APCA Lc 35.8, failing even the large-text floor, which is
why dark mode has to remap brand roles to steps 100-200 (see `color.md`). Adopting a dark marketing
page would mean either abandoning the brand teal or shipping a page whose accent fails contrast.
The Phenomenon qualities that actually transfer — alignment, restraint, hairlines, space, and the
intruding fold — are all independent of ground colour.

**Buttons keep a small radius rather than becoming fully square.** The reference uses ~6px. Fully
square corners on a youth-facing initiative read as severe.

**No trailing arrow glyph on CTAs by default.** The reference's `→` is directional and would need
mirroring to `←` under RTL; an arrow that points the wrong way is worse than no arrow. Where a
directional affordance is wanted, use a logical-property-aware icon rather than a literal glyph.
