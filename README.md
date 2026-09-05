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

| Path              | What lives there                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `apps/web`        | Next.js — public Feed, Tracks, landing page, Editor review surface  |
| `apps/native`     | Expo — iOS and Android                                              |
| `packages/`       | Shared deep modules. See [packages/README.md](./packages/README.md) |
| `docs/adr/`       | Architectural decisions, numbered                                   |
| `docs/design/`    | Design system and motion specification                              |
| `.claude/skills/` | 64 installed agent skills                                           |
| `.scratch/`       | Tickets, one file each                                              |

## Checks

`pnpm check` is the gate: types, lint, module boundaries, tests, and production builds for both apps. Nothing merges without it.

`pnpm lint:boundaries` alone checks the deep-module rules, which are error-level and have been verified to fail on a real violation rather than merely configured.

## Reading order

Start with [CONTEXT.md](./CONTEXT.md) — the domain glossary. The vocabulary is deliberate and load-bearing: a Task is not a challenge, a Member is not a user, and a Point is minted only by an accepted Submission.

Then [AGENTS.md](./AGENTS.md), which is the entry point for both the humans and the two agents working here, and the ADRs in [docs/adr/](./docs/adr/) covering whatever you are about to change.

## Working with Arabic

The imported craft skills assume Latin script. [`.claude/skills/faseela-arabic-rtl/`](./.claude/skills/faseela-arabic-rtl/SKILL.md) overrides them and is worth reading before any layout, type, or motion work. Two rules cause the most damage when missed: `letter-spacing` on Arabic severs cursive joins and reads as misspelling, and any number adjacent to Arabic text needs bidi isolation or its digits visually jump.

### Arabic in the terminal

JetBrains' terminal never runs the Unicode Bidirectional Algorithm — the classic
JediTerm engine and the 2026.x reworked one both paint cells strictly
left-to-right. Our Arabic reaches it byte-correct and comes out backwards: the
first letter of a word sits leftmost, and the words of a sentence run in reverse.
Windows Terminal and the VS Code terminal have the same gap, so this is not a
setting anyone can flip.

Pipe output through the filter instead:

```bash
pnpm dev 2>&1 | pnpm ar
pnpm test 2>&1 | pnpm ar
node scripts/verify-journey.mjs | pnpm ar
```

`pnpm ar:test-card` prints the same sentences unprocessed, reordered, and
reordered-plus-shaped, so you can see which your font handles best; pass
`--mode=reverse` if your terminal already joins Arabic letters and only the
order is wrong.

The filter is display-only and never touches stored data. When you need Arabic
to be exactly right — reviewing copy, checking a seed fixture — read it in the
editor, which does implement bidi properly.

## Who works here

Two agents and one human, coordinating only through committed files. [docs/agents/ownership.md](./docs/agents/ownership.md) has the boundary; [ADR 0008](./docs/adr/0008-two-agent-operating-model.md) has the reasoning.
