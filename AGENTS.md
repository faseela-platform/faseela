# Faseela Platform

Universal platform for مبادرة فسيلة — Next.js web, Expo native, shared UI. Arabic-only content, RTL-native architecture.

## Read first

Read [CONTEXT.md](./CONTEXT.md) for the domain glossary and use its vocabulary in code, tickets, and prose. A Task is not a challenge; a Member is not a user; a Point is not a score.

Read the ADRs in [docs/adr/](./docs/adr/) that touch what you are about to change. When your plan contradicts one, say so and stop — an ADR is a decision, and revising it is a conversation, not an edit.

## Arabic and RTL

Arabic is the content language and RTL is the layout default. The imported craft skills assume Latin script throughout, so [.claude/skills/faseela-arabic-rtl/SKILL.md](./.claude/skills/faseela-arabic-rtl/SKILL.md) is the authority wherever they disagree. Read it before writing layout, type, or motion.

Reach for logical CSS properties — `margin-inline-start`, `inset-inline-end`, `padding-block` — so a single stylesheet serves both directions.

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
