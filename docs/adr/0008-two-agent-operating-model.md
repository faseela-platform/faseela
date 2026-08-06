---
status: accepted
date: 2026-08-06
---

# Two agents share this repo; the repo is the shared memory

Two agents write code here — Manus and Claude Code — and one human merges. They do not talk to each other. Coordination happens entirely through committed artefacts: `CONTEXT.md` for vocabulary, `docs/adr/` for decisions, `docs/design/` for the design system and motion specification, and `.scratch/<feature>/issues/` for tickets. A ticket is the unit of handoff.

This is recorded because the division is not deducible from the code and because getting it wrong is expensive in a specific way: two agents editing the same files without a boundary produce merge conflicts that neither can resolve, and a human ends up rewriting both.

## The division, and why it falls this way

The useful axis is not which agent is more capable but which is closer to the artefact. Claude Code sits in the working tree with instant file access and millisecond test loops, which makes it the right implementer. Manus holds the research context, drives a real browser to verify Arabic rendering and layout shift, generates assets, reads the live web, and holds credentials-bearing integration work — which makes it the right author of specifications, design systems, and anything requiring the outside world.

So: Manus owns research, ADRs, `CONTEXT.md`, the design system, generated assets, landing-page art direction and motion, browser-based visual and RTL review, live integrations, and deployment. Claude Code owns implementing tickets, the Drizzle schema, Better Auth wiring, Payload collections, the `packages/ui` build-out, tests, and mechanical refactors. Abdullah owns merging, and everything touching money, accounts, or the Initiative's leadership.

## Consequences

Every ticket must be a tracer-bullet vertical slice sized to one fresh context window, because an agent that runs out of context mid-ticket leaves the repo in a state the next agent cannot reason about. Tickets declare blocking edges so either agent can work the frontier without asking.

Both agents read `AGENTS.md` first; it is deliberately short, because it is loaded on every turn and everything in it costs attention whether or not it fires. Depth lives behind pointers.

The `git-guardrails` hook blocks destructive git commands — `push`, `reset --hard`, `clean`, `branch -D` — from executing without the human. With two agents committing, an unattended force-push is the one failure that loses work rather than merely wasting time.
