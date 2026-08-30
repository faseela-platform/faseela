# @faseela/tokens

The design system as code. Colour, type, and motion.

## Entry points

| Import                      | Use for                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@faseela/tokens/theme.css` | The web. A Tailwind v4 `@theme` block plus semantic roles.                                                                    |
| `@faseela/tokens`           | Motion `transition` objects, tests — OKLCH strings.                                                                           |
| `@faseela/tokens/native`    | React Native: the same scales and roles as precomputed hex.                                                                   |
| `@faseela/tokens/brand`     | The mark's geometry and colours (logo 6a, ADR 0029) — the single source for `<Mark>`, the icons, the 3D scene and the Lottie. |

`theme.css` is the source of truth. The TypeScript mirrors it, because Motion and React
Native cannot read a CSS custom property.

## Why the duplication is safe

`tests/parity.test.ts` parses `theme.css` and asserts the TypeScript matches it. Change one
without the other and the test fails, naming the token that drifted. Two unchecked copies of
the same numbers would be worse than none.

The same file asserts the _constraints_ the numbers exist to satisfy — display leading never
below 1.42, body leading above Latin's 1.5, `--leading-tight` overridden, dark-mode brand
roles in the 100–200 range. So an edit that keeps both copies in sync but reintroduces a known
defect still fails.

Verified by deliberately setting body leading to 1.5: two tests failed, one on parity and one
on the floor. Reverted.

## Using it

```css
/* apps/web/app/globals.css */
@import "tailwindcss";
@import "@faseela/tokens/theme.css";
```

```tsx
import { duration, easing, stagger } from "@faseela/tokens";

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: duration.modal / 1000, ease: easing.enter }}
/>;
```

Reference semantic roles rather than ramp steps in components — `var(--brand)`, not
`var(--color-seedling-500)`. Swapping a role then stays one edit.

## Three constraints worth knowing before you use these

**The brand teal is large-text-only.** APCA Lc 51.3 on paper, against a body floor of 60. Use
it for fills, display type, and non-text UI. Body text takes `--ink` or step 700+.

**It also cannot be made more vivid.** Step 400 sits at 99% of the sRGB chroma ceiling for its
lightness, so it clips under `opacity` and `filter`. Cross-fade between two full-strength
tokens instead of fading a brand fill over a brand ground.

**`letter-spacing` is forbidden on Arabic.** It severs the cursive joins and reads as
misspelling. There is no tracking token here for that reason.

## Adding a token

Add it to `theme.css` first, then to the matching `lib/*.ts`, then extend `tests/parity.test.ts`
to cover it. A token with no parity assertion is a token that will drift.

Provenance for every value, plus the scripts that measured them, is in `docs/design/`.
