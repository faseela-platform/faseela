# ADR 0018 — Members sign in with magic links only

- **Status:** Accepted
- **Date:** 2026-08-07
- **Depends on:** [ADR 0016](./0016-erasure-anonymises-it-does-not-delete.md), [ADR 0017](./0017-payload-lives-in-its-own-postgres-schema.md)

## Context

Faseela's Members are volunteers in Lebanon — schoolteachers, students, people
organising tree-planting on weekends. They are not operating a financial account, and
the platform's job is to record what they did and show them a Leaderboard. Every
authentication mechanism carries a cost paid by the least technical member, and the
question is which cost is smallest.

Passwords fail this population specifically. A password is a thing to forget, and
recovering it requires exactly the emailed link that a magic link uses directly — so
passwords add a failure mode without removing one. Social sign-in via Google would work
for many, but it makes account access contingent on a Google account and on Google's
availability in the region, and it means the platform's member list is partly outside
its own control.

Magic links leave email as the sole identifier, which concentrates all the risk in one
place: email delivery. That concentration is the real subject of this decision.

## Decision

Better Auth with the magic-link plugin, no passwords, no social providers. Sessions last
thirty days on a sliding window. Links last ten minutes and are stored hashed.

### The identity tables are declared in `packages/db`, not generated

Better Auth ships a CLI, `npx auth@latest generate`, that writes the Drizzle schema for
`user`, `session`, `account` and `verification`. That CLI is deliberately not part of
this project's workflow.

`packages/db` is the single description of the database, and the four identity tables
carry things the generator does not know about: the `anonymised_at` column that ADR 0016
depends on, and the partial unique index on `phone_number`. Running the generator would
overwrite both. The table and column names match Better Auth's expectations exactly —
singular table names, which is the adapter's own default — so the adapter needs no
`usePlural` and no `modelName` remapping. The cost is that a future Better Auth version
adding a column requires a hand-written migration; the benefit is that the schema cannot
be silently rewritten by a tool.

### Email is a seam, because there is no domain yet

Faseela has no domain. Resend and every comparable provider require SPF and DKIM records
on a domain the sender controls; sending from a borrowed subdomain lands the mail in
Gmail's spam folder. For a product whose only way in is an emailed link, a spam-foldered
email is not degraded service — it is a locked door.

So `apps/web/lib/email.ts` exposes one function, `sendEmail`, and the auth layer knows
nothing else. In development it prints to the console. **In production it throws.**

That last part is the point. A console transport that silently no-ops in production
would make every sign-in appear to succeed: Better Auth returns 200, the member is told
to check their email, and nothing ever arrives. From the outside that is
indistinguishable from a slow mail server, and it is exactly the kind of failure that
survives a deployment unnoticed. Throwing makes it impossible to ship.

### The settings that differ from the defaults, and why

| Setting | Default | Ours | Reason |
| --- | --- | --- | --- |
| Link lifetime | 5 minutes | **10 minutes** | Members are on Lebanese mobile networks with intermittent connectivity, and commonly read mail on a phone while the browser that requested the link is on a laptop. Five minutes risks expiry mid-flow. |
| Token storage | plaintext | **hashed** | A magic-link token is a bearer credential: whoever holds it becomes the Member. Plaintext means anyone able to read the `verification` table can sign in as any member with a pending link. |
| Session lifetime | 7 days | **30 days** | Every sign-in requires opening an email. A short session converts directly into abandoned visits for a volunteer returning weekly. |
| `allowedAttempts` | 1 | **unset** | Deprecated upstream. Tokens are now consumed atomically on first use; setting it to anything but 1 emits a startup warning and changes nothing. |
| `deleteUser` | disabled | **explicitly disabled** | Better Auth's delete flow issues `DELETE FROM "user"`, which the RESTRICT on `point_award.user_id` rejects (ADR 0016). Leaving it available offers Members a button that always errors. |

## Consequences

**Two catch-all routes coexist under `/api`.** Better Auth answers at
`/api/auth/[...all]`, Payload at `/api/[...slug]`. Next.js resolves the static segment
`auth` ahead of the dynamic catch-all, so auth wins — but that is a framework resolution
rule, not a guarantee from either library. If a Payload upgrade widened its route, every
sign-in would start receiving Payload's 404 and the symptom would look like a token bug.
`scripts/verify-routes.mjs` asserts it instead of trusting it.

**Two independent secrets.** `BETTER_AUTH_SECRET` signs Member sessions;
`PAYLOAD_SECRET` signs Editor sessions. They are deliberately different values: the two
systems authenticate different populations, and one shared secret means rotating Editor
credentials silently logs out every Member.

**An account is created on verification, not on request.** A sign-in request writes only
a `verification` row. This was confirmed empirically, and it is a useful property — an
unverified request cannot squat an email address, and an abandoned sign-in leaves nothing
behind after ten minutes.

**Requests without an `Origin` header are rejected** with
`MISSING_OR_NULL_ORIGIN`. This is CSRF defence and applies to any script or integration
that posts to the auth endpoints, not just browsers.

**Verifying a link on an unverified pre-existing account revokes its password and
sessions.** Better Auth treats email ownership, proven by the link, as the source of
truth. This has no effect today because passwords are disabled, but it constrains any
future decision to enable them.

## Verification

`scripts/verify-auth-flow.mjs` walks the whole flow against the running app and the live
database: requests a link, asserts the stored token is a hash rather than the address,
asserts the ten-minute TTL, redeems the link, and confirms a member row with
`email_verified = true`, an Arabic display name that survived the round trip, exactly one
session row, and a replay that fails with `INVALID_TOKEN`. It uses an address at the
RFC 2606 `.invalid` TLD and cleans up after itself.

That last assertion is the one worth keeping. A magic link that can be redeemed twice is
a credential sitting in the member's inbox indefinitely.

## References

- Better Auth magic link plugin: <https://www.better-auth.com/docs/plugins/magic-link>
- Better Auth Drizzle adapter: <https://www.better-auth.com/docs/adapters/drizzle>
- Better Auth with Next.js: <https://www.better-auth.com/docs/integrations/next>
- Next.js route resolution order: <https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes>
- RFC 2606, reserved top-level domains: <https://www.rfc-editor.org/rfc/rfc2606>
- SPF and DKIM requirements for bulk senders (Gmail):
  <https://support.google.com/a/answer/81126>
