# 14. One database, three owners, explicit boundaries

Date: 2026-08-07

## Status

Accepted

## Context

Three systems write to the same Neon database: Better Auth owns identity, Payload
owns editorial content, and our Drizzle schema owns Tracks, Tasks, Submissions
and the Point ledger. All three use Drizzle underneath, which sounds like
harmony and is actually the hazard — each believes it may manage the schema.

Payload's Postgres adapter documentation states that **by default Payload drops
the current database schema** when it initialises against a database it does not
recognise. Pointed at our database, it can drop our tables. Separately, Better
Auth owns a table named `user`, and a Payload collection slugged `users` maps to
the same table name; whichever migrates last wins, and the loser's columns
vanish.

There is also a modelling question underneath the operational one. The domain
speaks of a _Member_ (مشترك). Is a Member a separate table joined to the auth
user, or is it the same row?

## Decision

**One database, three disjoint table sets, one migration authority per set.**

Better Auth owns `user`, `session`, `account`, `verification`. Those names are
fixed by its Drizzle adapter, which resolves tables by exported property name,
so they stay singular and are regenerated with `npx auth@latest generate` rather
than hand-edited.

Payload owns its own tables and is configured with `push: false` in production so
it never diffs-and-applies against a live database. Its collections must not be
slugged `user`, `users`, `session`, `account`, `verification`, `track`, `task`,
`submission`, `season`, or `point_award`.

Our schema owns the domain tables and migrates only through committed
`drizzle-kit generate` files. `db:push` is not used at all — not even locally —
because the habit is the risk.

**A Member is the Better Auth user row, not a second table.** `submission.user_id`
and `point_award.user_id` reference `user.id` directly. CONTEXT.md defines a
Member as "a person who has joined the Initiative on the platform"; nothing about
membership is knowable without identity, so a separate table would be a
one-to-one join added to every query in the product for no behaviour. Domain
attributes that Better Auth does not own (a display handle, a chosen Track) are
added as nullable columns on `user`, which the adapter tolerates because it reads
the columns it knows and ignores the rest.

## Consequences

Three migration authorities can no longer collide, but only because the table
name sets are disjoint _by convention_ — nothing in Postgres enforces it. A new
Payload collection slugged `users` would still be a live-data incident. The
prohibited-slug list above is therefore repeated in the Payload config as a
comment, and adding a collection is a review point.

Because a Member _is_ a user, deleting a user cascades to Submissions but is
`restrict`ed by Point awards (ADR 0015) — so a Member with earned Points cannot
be hard-deleted. That is the correct outcome for a record of effort and the wrong
outcome for a data-deletion request; when that arrives it will need anonymisation
of the `user` row rather than deletion, and that is a decision for its own ADR.

`db:push` being banned means the fastest local loop is slightly slower: a schema
change requires generating a migration. That is the intended trade.
