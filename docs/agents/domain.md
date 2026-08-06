# Domain docs

Single-context repo: one [`CONTEXT.md`](../../CONTEXT.md) at the root holding the glossary, and [`docs/adr/`](../adr/) holding architectural decisions.

```
/
├── CONTEXT.md          ← the glossary, and nothing else
├── docs/
│   └── adr/            ← 0001-…, 0002-…, numbered sequentially
├── apps/
└── packages/
```

## Before exploring

Read `CONTEXT.md` and the ADRs covering the area you are about to touch. Both are short by design.

## Using them

Write in the glossary's vocabulary — in identifiers, ticket titles, commit messages, and conversation. When a term you need is missing, add it as you resolve it rather than batching; a glossary written later is a glossary written wrong.

`CONTEXT.md` holds meaning, never implementation. No table names, no framework references, no API shapes. If a line would change when the code changes, it belongs in an ADR or a README instead.

When work contradicts an ADR, flag the conflict explicitly rather than routing around it. An ADR records a trade-off someone reasoned through; the code silently disagreeing with it is how the reasoning gets lost.

## Adding an ADR

Warranted only when all three hold: the decision is hard to reverse, a future reader would wonder why it was done this way, and there were genuine alternatives. Anything easy to reverse gets reversed rather than documented.

Format is a title and one to three sentences. `Considered options` and `Consequences` sections earn their place only when the rejected alternative or the downstream effect is genuinely non-obvious.
