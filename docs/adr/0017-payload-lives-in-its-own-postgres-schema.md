# ADR 0017 — Payload lives in its own Postgres schema

> **Superseded (2026-08-24, [ADR 0023](./0023-editors-are-our-own-users-payload-removed.md)):** Payload is removed entirely. The `payload` schema and its thirteen tables are dropped from Neon, and `verify-isolation.mjs` no longer has two schemas to hold apart. The whole apparatus this ADR describes is retired.

- **Status:** Accepted
- **Date:** 2026-08-07
- **Supersedes nothing. Implements the boundary declared in** [ADR 0014](./0014-payload-owns-editorial-content-only.md)

## Context

ADR 0014 established that Payload owns editorial content and `@faseela/db` owns the
member domain — Members, Tracks, Tasks, Submissions, Seasons and the Point ledger.
That ADR settled _who owns what_. It left open _how the boundary is enforced_, because
both halves share a single Neon database on the free plan and a second database is not
available to us.

Payload's Postgres adapter is built on Drizzle, the same ORM `@faseela/db` uses, and by
default it manages the `public` schema — which is where our nine tables live. Payload's
own documentation is unambiguous about the consequence:

> By default, Payload drops the current database schema.

That sentence appears in the `beforeSchemaInit` section of the Postgres adapter
documentation, presented as the reason that hook exists. It means a Payload migration
run against the default schema is capable of dropping `point_award`. The ledger is
append-only and immutable by design (ADR 0007); losing it is unrecoverable, and every
Leaderboard standing in the product's history is derived from it.

Two options were available.

**Adopt our tables into Payload's schema view** using `beforeSchemaInit`, introspecting
`public` with drizzle-kit and handing the result to Payload so it knows those tables
exist and leaves them alone. This is the path Payload documents for teams migrating an
existing database into Payload.

**Give Payload its own Postgres schema** via the adapter's `schemaName` option, so it
operates in a namespace that cannot contain our tables at all.

## Decision

Payload runs with `schemaName: 'payload'`.

The reasoning is about what fails, not what works. Both options work when correctly
configured. They differ in what happens when the configuration is wrong.

Under `beforeSchemaInit`, correctness depends on our injected schema definition staying
faithful to the real `public` schema. Add a column in `packages/db`, forget to
regenerate the introspection, and Payload's view of `public` is now stale — it believes
a table has fewer columns than it does. Whether that stale belief causes a destructive
DDL statement depends on Drizzle's diffing behaviour, which is not a contract we
control. The failure is silent until it isn't.

Under `schemaName`, correctness depends on one string. If Payload honours it, our
tables are unreachable — not protected by a convention but absent from the namespace
Payload operates in. If Payload ignores it, Payload creates tables in `public`, and the
collections are slugged `editors`, `pages`, `announcements`, `media` — none of which
collides with `user`, `session`, `account`, `verification`, `track`, `task`,
`submission`, `season` or `point_award`. The second line of defence is why the slug
`editors` was chosen over the more natural `users`: Payload auto-creates a `users`
collection when none is supplied, and `users` is one character from our `user`.

`schemaName` is marked **experimental** in Payload's documentation. That is the real
cost of this decision and the reason the fallback matters.

## Consequences

**A hand-written line in a generated migration.** Payload qualifies every statement as
`"payload"."..."` but does not emit the `CREATE SCHEMA` itself, so the first migration
failed with `schema "payload" does not exist`. `CREATE SCHEMA IF NOT EXISTS "payload"`
was added by hand at the top of `up()` in `20260807_113320.ts`, marked with a comment.
Future Payload migrations do not need it.

**Isolation is asserted, not assumed.** `scripts/verify-isolation.mjs` checks that all
nine of our tables are still in `public`, that none has appeared in `payload`, that no
Payload table has appeared in `public`, and that the ledger is readable. It runs after
every Payload upgrade, because `schemaName` is experimental and an upgrade is exactly
when experimental behaviour changes.

**`push` is off.** Payload enables Drizzle's `db push` in development by default. ADR
0014 bans push: it diffs and applies without producing a file, so there is nothing to
review and nothing to replay. Payload uses migrations only, in its own `cms/migrations`
directory, separate from `packages/db/migrations`.

**DDL uses the unpooled connection.** Migrations need session state — advisory locks, a
stable connection across statements — which PgBouncer in transaction mode cannot hold.
The adapter is pointed at `DATABASE_URL_UNPOOLED`. Pointing it at the pooler produces
failures that read as intermittent network faults.

**Cross-domain references are slugs, not relationships.** An Announcement links to a
Track by storing `trackSlug` as text. A Payload relationship would require Payload to
own the `track` table, which is the coupling this ADR exists to prevent. The cost is
that a renamed Track slug silently breaks the link; the benefit is that the two halves
remain independently deployable.

## Related structural change

Payload installs into the Next.js `app/` directory and manages its own `<html>` element.
Our site sets `lang="ar" dir="rtl"` on `<html>`, and every logical CSS property in the
codebase depends on it. A single shared root layout would force one of the two to be
wrong — and a `dir="rtl"` ancestor around Payload's admin mirrors that entire interface.

The frontend therefore moved into an `app/(site)/` route group with its own root layout,
alongside `app/(payload)/` with Payload's. Route groups do not appear in URLs, so `/` is
unchanged. Payload's admin renders `dir="RTL" lang="ar"` from its own layout because
`i18n.fallbackLanguage` is `ar` — Payload derives direction from the active locale,
which is what makes the _field inputs_ RTL. An Editor typing an Arabic Task title into
an LTR input sees punctuation jump to the wrong end of the line and "fixes" it with
characters that then ship to Members.

## References

- Payload Postgres adapter — `schemaName`, `push`, `beforeSchemaInit`:
  <https://payloadcms.com/docs/database/postgres>
- Payload admin project structure and the `(payload)` route group:
  <https://payloadcms.com/docs/admin/overview>
- Next.js route groups:
  <https://nextjs.org/docs/app/building-your-application/routing/route-groups>
- PgBouncer transaction pooling limitations:
  <https://www.pgbouncer.org/features.html>
