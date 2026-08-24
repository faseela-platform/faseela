# 0022 — The admin panel is closed until it is claimed

> **Superseded (2026-08-24, [ADR 0023](./0023-editors-are-our-own-users-payload-removed.md)):** Payload is removed, so its `/admin` panel and create-first-user screen no longer exist. The `ENABLE_ADMIN` gate and `scripts/verify-admin-gate.mjs` are deleted; the race this ADR closed cannot recur. Staff roles are now conferred on existing `user` rows, not claimed at a public screen.

Date: 2026-08-07
Status: Accepted

## Context

Payload has no first user until one is created, and it offers a create-first-user screen
to whoever arrives at `/admin` first. There is no invitation, no pre-provisioning and no
challenge: the screen is the enrolment mechanism.

On a public deployment this is a race. The path is Payload's documented default, not a
secret, and deployment platforms surface routes. Whoever reaches it first becomes the
administrator of Faseela's content management system, able to publish, unpublish and
rewrite anything the initiative says in its own name. Faseela's credibility is the asset
here; the database can be restored from a backup, a forged announcement in the
initiative's voice cannot be un-read.

The window was going to be opened by the first deploy to Vercel, ahead of any decision
about who administers the CMS.

## Decision

The admin panel and Payload's REST API return 404 in production unless `ENABLE_ADMIN` is
explicitly set to `true` in the deployment environment.

Enforced in `apps/web/middleware.ts`, which runs before route resolution and therefore
before Payload initialises.

## Consequences

**The race is removed rather than won.** The alternative under consideration was to deploy
and immediately claim the account. That reduces the window to seconds but does not close
it, and it makes the safety of the system depend on the speed of one person on one
occasion. A flag makes the panel unreachable for as long as nobody has decided otherwise.

**Both the panel and the API are gated.** `/admin` is a client of Payload's REST endpoints,
not a guard in front of them; `POST /api/editors` creates a first Editor without loading
the UI at all. Gating only the panel would have protected the screen and left the
vulnerability reachable with a single curl command. The verification script asserts this
case specifically.

**`/api/auth/*` is exempt via negative lookahead in the matcher.** Better Auth shares the
`/api` prefix. Matching it would have returned 404 for every sign-in in production —
protecting the CMS by breaking the product. The verifier asserts that this path reaches
its handler, treating any status other than 404 as a pass, because what matters is that
the middleware did not intercept it.

**404 rather than 403.** A 403 confirms that an admin panel exists and is merely closed,
which tells an unauthenticated visitor precisely what to come back for. A 404 is
indistinguishable from a route that was never built. Payload's own not-found page is not
rendered, because doing so would boot Payload and open a database connection on behalf of
a request already refused.

**The gate is inert in development.** A protection that also obstructs daily work gets
disabled during daily work and then forgotten, which is how such things end up shipped
switched off. Locally the panel is always available.

**The flag value is trimmed.** During verification, `set ENABLE_ADMIN=true &&` on Windows
produced `"true "` — a value that failed a strict comparison and presented exactly as a
broken gate. The failure was in the safe direction, but a trailing space is invisible in a
dashboard field, and on the day the panel is opened it should not be necessary to suspect
one's own typing.

**Opening it is a deliberate, reversible act.** Set `ENABLE_ADMIN=true`, create the first
Editor account, and unset it. The panel closes again with the credential already claimed,
which is a materially better position than leaving enrolment permanently open.

## Verification

`scripts/verify-admin-gate.mjs`, run against a production build. Eleven checks: the panel
closed at three paths, the API closed including the first-user creation call, the four
member-facing pages open, and Better Auth reaching its handler. Both flag states were
exercised — closed by default, open at 200 when the flag is set.
