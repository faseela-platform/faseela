# Who owns what

Two agents write here and one human merges. They never talk to each other — [ADR 0008](../adr/0008-two-agent-operating-model.md) has the reasoning; this file is the operational boundary.

The axis is proximity to the artefact, not capability. Claude Code sits in the working tree with instant file access and fast test loops. Manus holds research context, drives a real browser, generates assets, reads the live web, and carries credentials.

| Area | Owner |
|---|---|
| Research, ADRs, `CONTEXT.md` | Manus |
| Design system, tokens, `docs/design/` | Manus |
| Generated assets — imagery, posters, icons | Manus |
| Landing page art direction and motion | Manus |
| Visual, RTL and accessibility review in a real browser | Manus |
| Live integrations needing credentials | Manus |
| Infrastructure and deployment | Manus |
| Ticket implementation | Claude Code |
| Drizzle schema and migrations | Claude Code |
| Better Auth wiring | Claude Code |
| Payload collections | Claude Code |
| `packages/ui` build-out | Claude Code |
| Tests and mechanical refactors | Claude Code |
| Merging, money, accounts, leadership | Abdullah |

## Claiming work

A ticket's `Status` line is the claim. Set it to `in-progress (claude-code)` or `in-progress (manus)` in the same commit that starts the work, so the other agent sees the claim before duplicating it. Set it to `ready-for-human` when it wants review.

Work only tickets whose blockers are complete. When a ticket turns out to need something the other agent owns, split it rather than crossing the boundary — a ticket that reaches across is a ticket that produces a conflict neither agent can resolve.

## Branches

One branch per ticket, named `<NN>-<slug>` to match its file. Both agents branch from `main` and neither rebases the other's branch.

`git-guardrails` blocks `push`, `reset --hard`, `clean` and `branch -D` from running unattended. With two agents committing, those are the commands that lose work rather than waste time, so a human confirms them.
