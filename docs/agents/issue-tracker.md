# Issue tracker

Issues live as markdown files in this repo, under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order so blockers come first.

Local files rather than GitHub Issues, for now, for one reason: the `gh` CLI is not installed on the development machine. Once it is and the private `faseela-platform` remote exists, this file is where the switch gets recorded — the tickets themselves do not change shape, only where blocking edges are expressed.

## Ticket shape

```md
# <NN> — <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the Member's or Editor's perspective — not a layer-by-layer implementation list.

**Blocked by:** the numbers of the tickets that gate this one, or "None — can start immediately".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

Each ticket is a tracer bullet: a narrow but complete path through schema, API, UI and tests, demoable on its own, sized to fit one fresh context window.

Write ticket titles and bodies in the vocabulary of [CONTEXT.md](../../CONTEXT.md). Keep file paths and code snippets out of them — those go stale within days. The exception is a snippet that encodes a decision more precisely than prose can, such as a schema or a state machine.

## Working the frontier

Pick up any ticket whose blockers are all complete. Set `Status: in-progress` with your agent name when you start, so the other agent sees the claim, and back to `ready-for-human` when the work wants review.

## Wide refactors

A mechanical change whose blast radius crosses the whole repo does not fit a vertical slice. Sequence it expand → migrate in batches → contract, each batch its own ticket, so the checks stay green between tickets rather than only at the end.
