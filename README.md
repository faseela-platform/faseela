# Faseela Platform

The digital home of **مبادرة فسيلة** — a Lebanese cultural initiative. One codebase serving web, iOS and Android: an aggregated Feed of the Initiative's work across its channels, themed Tracks carrying Tasks, and a Points-and-Seasons system that rewards cultural effort.

Arabic-only content, RTL-native architecture.

## Getting started

```bash
pnpm install
pnpm dev
```

Node 24 is required — `.nvmrc` pins it. If your machine is missing Node 24, the GitHub CLI, or Playwright browsers, run the setup wizard:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-machine.ps1
```

## Layout

| Path | What lives there |
|---|---|
| `apps/web` | Next.js — public Feed, Tracks, landing page, Payload admin |
| `apps/native` | Expo — iOS and Android |
| `packages/` | Shared deep modules. See [packages/README.md](./packages/README.md) |
| `docs/adr/` | Architectural decisions, numbered |
| `docs/design/` | Design system and motion specification |
| `.claude/skills/` | 64 installed agent skills |
| `.scratch/` | Tickets, one file each |

## Checks

`pnpm check` is the gate: types, lint, module boundaries, tests, and production builds for both apps. Nothing merges without it.

`pnpm lint:boundaries` alone checks the deep-module rules, which are error-level and have been verified to fail on a real violation rather than merely configured.

## Reading order

Start with [CONTEXT.md](./CONTEXT.md) — the domain glossary. The vocabulary is deliberate and load-bearing: a Task is not a challenge, a Member is not a user, and a Point is minted only by an accepted Submission.

Then [AGENTS.md](./AGENTS.md), which is the entry point for both the humans and the two agents working here, and the ADRs in [docs/adr/](./docs/adr/) covering whatever you are about to change.

## Working with Arabic

The imported craft skills assume Latin script. [`.claude/skills/faseela-arabic-rtl/`](./.claude/skills/faseela-arabic-rtl/SKILL.md) overrides them and is worth reading before any layout, type, or motion work. Two rules cause the most damage when missed: `letter-spacing` on Arabic severs cursive joins and reads as misspelling, and any number adjacent to Arabic text needs bidi isolation or its digits visually jump.

## Who works here

Two agents and one human, coordinating only through committed files. [docs/agents/ownership.md](./docs/agents/ownership.md) has the boundary; [ADR 0008](./docs/adr/0008-two-agent-operating-model.md) has the reasoning.
