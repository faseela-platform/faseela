# 0016 — Erasure anonymises a Member; it does not delete them

- **Status:** accepted
- **Date:** 2026-08-07
- **Decides:** what happens to the Point ledger when a Member closes their account
- **Follows:** [0015 — Points are an append-only ledger](./0015-points-are-an-append-only-ledger.md)

## Context

`packages/db` shipped with `point_award.user_id` declared `ON DELETE CASCADE`.
Nobody noticed, because nothing about the migration looked wrong: `db:migrate`
printed `[✓] migrations applied successfully!` and all twenty unit tests passed.
The tests passed because none of them deleted a user — the invariant was never
exercised, so its absence was invisible.

`scripts/verify-db.mjs`, which asserts the *live* schema rather than trusting the
migration's exit code, found it. The cascade had been copied from `session` and
`account`, where cascade is correct, into the one table where it is not.

Left in place, closing one account would silently delete that Member's every
Point award. Because a Leaderboard is computed from the ledger rather than stored,
the visible effect would be that **a completed Season's results change months
after it ended**, with no record that anything happened. CONTEXT.md defines a
Point as "a record, not a currency"; a record that disappears when its subject
leaves is not a record.

The competing obligation is real: a Member has a legitimate claim to have their
personal data removed, and Faseela works with young people, which raises rather
than lowers the standard.

## Decision

**Erasure scrubs the identifying columns of the `user` row and keeps the row.**

1. `point_award.user_id` is `ON DELETE RESTRICT`. The database refuses to delete a
   Member who has earned Points.
2. `user.anonymised_at` records when erasure happened. Nullable — its absence is
   precisely the meaning of a live account.
3. `anonymiseMember()` in `packages/db/lib/members.ts` is the only sanctioned
   removal path. It is exported from the package root so that a developer looking
   for "delete user" finds it before reaching for raw SQL.

What is destroyed: real name, email address, avatar, phone number, and **every
row in `session` and `account`** — all credentials and live sessions, so the
account cannot be signed back into.

What survives: the opaque `id`, a placeholder Arabic display name (`عضو سابق`),
a synthetic unique email at the RFC 2606 reserved `.invalid` TLD, and the ledger.

## Consequences

Past Seasons stay correct. An erased Member still occupies their rank, shown as
`عضو سابق` — the effort is still counted, the person is no longer named.

`email` is `NOT NULL UNIQUE`, so it cannot be blanked; two erased members would
collide on the empty string. Deriving the placeholder from the already-unique `id`
makes collisions impossible by construction rather than by luck.

`anonymiseMember` is idempotent and returns the *original* date on a second call,
because that date is the evidence of when the obligation was discharged, and an
erasure request that gets forwarded and actioned twice must not overwrite it.

**A hard deletion path is deliberately absent.** If a regulator or court ever
compels true erasure of a specific Member, that will be a deliberate migration
with the ledger consequences understood and recorded — not a routine code path
that anyone can call by accident.

`verify-db.mjs` now asserts **both directions**: nothing may cascade into
`point_award`, and `session`/`account` *must* cascade. Asserting only the first
would let a well-meaning "make everything RESTRICT" sweep leave sessions
unrevokable, which would break erasure in the opposite direction.

### What this episode says about the process

The unit tests were not wrong; they were silent. Twenty passing tests and a
successful migration reported a schema that violated ADR 0015. Asserting the live
database's own catalogue is a different kind of check from testing behaviour, and
it is now a standing step after every migration, not a one-off.

## Alternatives rejected

**Keep `CASCADE`.** Cleanest erasure, and defensible in a system where the data is
only about the person. Rejected because it silently rewrites finished Seasons, and
silence is the disqualifying property.

**`SET NULL` on `user_id`.** Points survive, detached. Rejected because the column
would have to become nullable, so every Leaderboard query and every `sum(points)`
grows a null case, and orphaned awards belong to no one while still inflating
totals — corruption that is harder to reason about than deletion.

**A separate `deleted_user` archive table.** Rejected as the same data with a
second schema to keep in step, and the archive would need the same FKs to be
useful.

## References

- [PostgreSQL: `FOREIGN KEY` referential actions](https://www.postgresql.org/docs/18/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [RFC 2606 — Reserved Top Level DNS Names](https://www.rfc-editor.org/rfc/rfc2606) (`.invalid` can never resolve)
- [PostgreSQL: `pg_constraint.confdeltype`](https://www.postgresql.org/docs/18/catalog-pg-constraint.html) — how the verifier reads delete behaviour
- [GDPR Art. 17(3) / Recital 26](https://gdpr-info.eu/art-17-gdpr/) — erasure is not absolute, and anonymised data falls outside the Regulation's scope
- [ISO/IEC 29100 Privacy framework](https://www.iso.org/standard/45123.html) — anonymisation vs pseudonymisation, the distinction this ADR relies on
