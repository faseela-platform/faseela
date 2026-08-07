# 10. The neutral ramp carries a faint teal cast

Date: 2026-08-06

## Status

Accepted. Confirmed by Abdullah in round 3 (A2 = A, keep the faint cast). Also confirmed that no brand
guide exists (A3 = B), so the measurements in `docs/design/color.md` are now the authoritative brand
reference for the project.

## Context

We measured Faseela's brand colours from the original 1080×1080 logo asset rather than from a
screenshot, filtering ~1.16M pixels by saturation to separate ink from paper. The paper ground
measured `oklch(0.961 0 89.9)` — **chroma exactly zero**, a true neutral grey. There is no cream in
the identity, contrary to an earlier reading taken from a small Instagram avatar.

A design system needs a full neutral ramp for surfaces, borders, and text, not a single value. The
question is whether that ramp should be a pure achromatic grey, faithful to the measurement, or
carry a slight cast toward the brand hue.

Pure `C = 0` greys are faithful but read as cold and slightly disconnected when placed next to
saturated brand fills — the neutral looks like it came from a different system. A near-imperceptible
cast toward the brand hue makes surfaces feel of-a-piece. This is common practice, but it *is* a
departure from what the logo actually contains.

## Decision

Give the neutral ramp a cast of `C 0.004` (steps 50–500) rising to `C 0.006` (steps 600–950) at the
seedling hue, `H 178.3`.

These values are below or at the threshold of perceptibility in isolation — the cast is only
detectable as a relationship, not as a colour. The ramp remains functionally neutral.

## Consequences

Surfaces, borders and muted text feel related to the brand rather than borrowed from Tailwind's
default grey. The trade-off is that `--paper-50` is not the logo's `#f2f2f2`; it is `#f7fbfa`.

This is a reversible decision with a single point of change: the `C` values in the neutral ramp
generator (`_manus/scripts/build_scales.py`) and the tokens in `docs/design/color.md`. Setting them
to `0` restores strict fidelity to the measurement.

Flagged for Abdullah because it is the one place in the colour system where we deliberately depart
from the measured identity, and because "faithful but colder" is a legitimate preference that only
the client can settle. If Faseela's leadership have brand guidelines we have not seen, those
supersede this.
