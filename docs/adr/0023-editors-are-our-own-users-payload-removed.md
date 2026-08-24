# 0023 — Editors are our own users; Payload is removed

- **Status:** accepted
- **Date:** 2026-08-24
- **Decides:** who owns Editor identity, and whether Payload stays in the stack
- **Supersedes the Payload half of:** [0003 — Neon + Drizzle, Better Auth and Payload](./0003-neon-drizzle-better-auth-payload.md), [0014 — One database, three owners](./0014-one-database-three-owners.md), [0017 — Payload lives in its own Postgres schema](./0017-payload-lives-in-its-own-postgres-schema.md), [0022 — The admin panel is closed until it is claimed](./0022-the-admin-panel-is-closed-until-it-is-claimed.md)

## Context

Payload 3 was adopted (ADR 0003) as the Editor-facing admin, given its own tables
(ADR 0014) and then its own `payload` Postgres schema (ADR 0017) to keep it from
dropping ours. It owned Editors, Pages, Announcements and Media, and it served the
`/admin` panel, which ADR 0022 then had to gate behind `ENABLE_ADMIN` so the
create-first-user screen could not be claimed by a stranger on the first deploy.

Three ADRs of defensive machinery accumulated around a component, and it was worth
asking what the component was actually carrying. The answer, once looked for, was
almost nothing.

**No rendered surface reads Payload content.** The landing page is hand-authored in
`app/(site)/content.ts`. Every member-facing page — Tracks, Tasks, the Leaderboard,
sign-in, attestation — reads through `@faseela/db` and authenticates through Better
Auth. Pages, Announcements and Media collections existed in the admin, but nothing
in the product ever queried them; the Feed that would consume Announcements is not
built yet (ADR 0013 settled that it is authored on the platform, not ingested, but
that authoring surface was never wired to Payload). Removing Payload therefore broke
zero public surfaces, because there were none to break.

**The one real dependency was Editor identity.** A Submission is Reviewed by an
Editor, and an Editor was a row in Payload's `editors` collection, in the `payload`
schema. That separation is the direct reason `submission.reviewed_by` and
`submission_attempt.reviewed_by` were opaque text rather than foreign keys: ADR 0014
forbids cross-schema references, so a reviewer's identity could not be a real
relationship. The column named who reviewed but the database could not enforce that
the name pointed at anyone.

So the cost of Payload was three ADRs of isolation machinery, a second migration
authority, an experimental `schemaName`, a gated admin panel, and an un-enforceable
reviewer column — carried for one collection we could model ourselves.

## Decision

**Payload is removed entirely. Editors become our own users, distinguished by a role.**

A `role` column is added to the Better Auth `user` table — enum `user_role` =
`('member', 'editor', 'admin')`, default `'member'`. This does not contradict ADR
0014's "a Member is the user row": it extends the same idea. A Member is a `user`
with progress; an Editor or Admin is a `user` carrying a staff role. The two are the
same table because identity is the same fact.

Roles are not self-serve. Magic-link sign-in (ADR 0018) creates `member` rows and
only `member` rows; a staff role is conferred by a deliberate update, never by
anything a visitor can reach. Where ADR 0022 removed the _race_ to become the
administrator by gating the panel, this removes the _screen_ — there is no
create-first-user path to guard, because becoming staff is an act performed on an
existing account by someone who already can.

**`submission.reviewed_by` and `submission_attempt.reviewed_by` become real foreign
keys to `user.id`.** With reviewers now in the same `public` schema as Submissions,
the cross-schema prohibition that forced opaque text no longer applies, and the
database can enforce what the column always meant: a reviewer is a user that exists.

Neither foreign key carries an `onDelete` action. Staff are anonymised, never
hard-deleted (ADR 0016), so the cascade-versus-restrict question the ledger faced
does not arise here — an Editor's `user` row is scrubbed in place and keeps its `id`,
so a Review always continues to point at a row that exists. `RESTRICT` would guard a
deletion path that ADR 0016 already establishes does not exist; `CASCADE` would erase
the record of who Reviewed a Submission, which is exactly the kind of history the
Point ledger (ADR 0015) keeps precisely because it was earned.

**Content authoring is dropped, not ported.** Pages, Announcements and Media had no
reader, so there is nothing to preserve today. When the Feed is built (Slice 5) and
actually needs Editors to compose Announcements, the authoring surface will be a
custom Arabic-RTL one, built for `dir="rtl"` from the first line rather than coaxed
into it. ADR 0017 already documented the friction of the alternative — Payload's
admin had to derive RTL from `i18n.fallbackLanguage`, and an Editor typing an Arabic
title into an LTR input watches punctuation jump to the wrong end.

The review surface is built at `app/(site)/muraja3a/`, authenticated by Better Auth
role rather than `payload.auth`: `requireEditor` reads the role from the database on
every request and answers `notFound()` — a 404, not a 403 — to a signed-in
non-staff visitor, so the queue does not announce itself. It lives inside the
existing `(site)` route group rather than a separate `(review)` group because, with
Payload gone, there is no second `<html>` to hold apart: the member site's Arabic
RTL root layout is exactly the chrome an Editor should see, and a sibling group
would only duplicate it. A dedicated group can be split out later if the editing
surface ever needs a distinct shell.

## Consequences

**One authentication system, one schema.** Better Auth is now the only source of
identity, and `public` is the only schema — the `payload` schema and its thirteen
tables are dropped from Neon. The three-owners model of ADR 0014 collapses to one
owner: `@faseela/db` and Better Auth migrate the same `public` schema, and the
prohibited-slug list, the disjoint-table-set convention, and the two coexisting
migration authorities all fall away with the second owner they existed to separate.

**The defensive machinery is deleted, not merely disabled.** The `/admin` route, the
`ENABLE_ADMIN` middleware gate, and `scripts/verify-admin-gate.mjs` are gone; ADR
0022's concern cannot recur because the thing it protected no longer exists.
`scripts/verify-isolation.mjs` (ADR 0017) loses its subject — there are no longer two
schemas to hold apart. The reviewer foreign keys should instead be asserted the way
every other referential action is, by `verify-db.mjs` (ADR 0016), which reads the
live catalogue rather than trusting a migration's exit code.

**What was given up.** Payload brought a rich-text editor, media upload and handling,
and draft/publish workflow — real capabilities, none of them wired to a reader, all
now absent until Slice 5 rebuilds the subset the Feed needs. This is a genuine cost
deferred, not a cost avoided: when authoring returns it must supply RTL rich text and
media on its own terms. The judgement is that building that surface once, natively,
when there is a reader for it, is cheaper than carrying a general-purpose CMS and its
isolation machinery in the meantime.

**What was gained.** One auth system instead of two, one schema instead of two, one
migration authority instead of three, an enforced reviewer identity instead of an
opaque string, and a clear path to an admin surface that is RTL-native rather than
RTL-configured. Four ADRs' worth of boundary-keeping is retired by removing the
boundary.

## References

- [ADR 0013 — No channel ingestion](./0013-no-channel-ingestion.md) — the Feed is authored on the platform, and that surface is what Slice 5 builds
- [ADR 0015 — Points are an append-only ledger](./0015-points-are-an-append-only-ledger.md) — why the record of who Reviewed is kept, not cascaded away
- [ADR 0016 — Erasure anonymises a Member](./0016-erasure-anonymises-it-does-not-delete.md) — staff are scrubbed in place, which is why the reviewer keys need no `onDelete`
- [ADR 0018 — Members sign in with magic links only](./0018-members-sign-in-with-magic-links-only.md) — magic-link sign-in creates members; staff roles are conferred separately
