# Faseela Platform

Universal platform for مبادرة فسيلة — Next.js web, Expo native, shared UI. Arabic-only content, RTL-native architecture.

## Read first

Read [CONTEXT.md](./CONTEXT.md) for the domain glossary and use its vocabulary in code, tickets, and prose. A Task is not a challenge; a Member is not a user; a Point is not a score.

Read the ADRs in [docs/adr/](./docs/adr/) that touch what you are about to change. When your plan contradicts one, say so and stop — an ADR is a decision, and revising it is a conversation, not an edit.

## Arabic and RTL

Arabic is the content language and RTL is the layout default. The imported craft skills assume Latin script throughout, so [.claude/skills/faseela-arabic-rtl/SKILL.md](./.claude/skills/faseela-arabic-rtl/SKILL.md) is the authority wherever they disagree. Read it before writing layout, type, or motion.

Reach for logical CSS properties — `margin-inline-start`, `inset-inline-end`, `padding-block` — so a single stylesheet serves both directions.

## Design system

Colour, typography, and motion are decided and measured in [docs/design/](./docs/design/) — reference the tokens, never raw values. Three constraints bite often enough to state here: the brand teal is large-text-only (APCA Lc 51.3) and body text needs step 700 or neutral ink; Arabic display leading never drops below 1.42, so `leading-tight` is wrong; and `letter-spacing` on Arabic severs the cursive joins and is forbidden.

## Motion budgets

Product UI motion is feedback: under 300ms, `transform` and `opacity` only, exits faster than enters. The landing page is the one place elaborate motion belongs — see [docs/design/landing-motion.md](./docs/design/landing-motion.md) — and its patterns stay there.

Scroll-linked motion is native CSS `animation-timeline` (ADR 0011). Keep promoted GPU layers under 10 on mobile, apply `will-change` via JS around an animation and remove it when it settles, and let unsupported browsers fall through to the static final state. Author the final state first and layer motion on top, so reduced-motion visitors never meet an element stranded at `opacity: 0`.

## Package boundaries

Packages are deep modules: import a package through its root files only. See [packages/README.md](./packages/README.md) before adding or importing one. `pnpm lint:boundaries` enforces it.

## Definition of done

`pnpm check` passes — types, lint, boundaries, tests, and production builds for web and native. Visual changes additionally need a Playwright screenshot in both directions and an accessibility pass.

## Agent skills

### Issue tracker

Issues live as markdown under `.scratch/<feature>/issues/`. See [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md).

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the root. See [docs/agents/domain.md](./docs/agents/domain.md).

### Who owns what

Two agents and one human share this repo and coordinate only through committed files. See [docs/agents/ownership.md](./docs/agents/ownership.md) before starting work that another agent may already hold.
