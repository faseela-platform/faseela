# 30. The member flow after the first traced review

Date: 2026-08-30

## Status

Accepted. Revises ADR 0011 (revised) on the landing's client JavaScript and records the
decisions taken from the owner-approved review of sign-in → work → points → sign-out.

## Context

Slices 1–9 shipped the whole member loop, but the first end-to-end trace of the request and
response cycle (web and mobile, 2026-08-30) found that the loop was correct at the seams and
wrong at the joins: a member's first screen after sign-in said «انضم إلينا»; an expired link was a
silent dead end; a first-time account was not routed to the §5 step; a duplicate phone number
was a stack trace; on the phone a completed Task could render as not done depending on which of
two requests landed first; rate limits lived in one lambda's memory; an upload key was trusted
verbatim. None of these were in any single module — they were between modules.

## Decision

1. **Where a magic link lands.** Back where the member came from when a `callbackURL` is present,
   else **`/mustajaddat`** — the personalised home (§3) is the natural "you are signed in". Never
   `/masarat`, whose nav is cached.
2. **The nav knows the member on static pages too.** `Nav` takes `signedIn` as three-valued:
   `true`/`false` are server truth (no flash); `undefined` mounts `nav-session.tsx`, a ~1 KB
   island using the already-exported `useSession`, which server-renders the signed-out link
   byte-for-byte and swaps after the session resolves. `/` and `/masarat` stay static/ISR. This
   is the second client island the landing carries (after the hero scene); ADR 0011's
   "zero-JS landing" is now "no JavaScript the page needs to be complete" — remove the island
   and the page is whole, only less personal.
3. **Sign-in errors are shown, in Arabic.** `errorCallbackURL` returns an expired or used link
   to `/dukhul?error=`, which renders `signInErrorMessage()`; `newUserCallbackURL` sends a
   first-time account to `/akmil-hisabak?next=`; a 429 shows the cap's message, not "check your
   address".
4. **Typed refusals, never throws, at the seam.** `setMemberProfile` returns `phone-taken`;
   `attestTask` and the review functions return `not-found`; the API maps them to `409`/`404`
   envelopes with distinct codes (`no-season`, `not_found`), and the app localises each.
5. **Rate limiting is shared state.** Better Auth's limiter stores in the `rate_limit` table
   (migration 0008) so every lambda counts the same bucket; the client IP is read from
   `x-real-ip` then `x-forwarded-for` (Vercel sets both from the connection); `/get-session` is
   exempt. A second cap of six sends per address per half hour rides in the `verification`
   table. `BETTER_AUTH_URL` is refused in production when unset or not https — except during
   `next build`, which has no runtime env and is not the served process.
6. **An upload key is a claim, not a fact.** `submitReviewWork` accepts only a key this server
   minted for this member and Task (`submissions/{task}/{user}/{uuid}.{ext}`), confirms the
   object exists and is under 10 MB with a signed HEAD (a query-signed PUT cannot bound size),
   and refuses in Arabic otherwise.
7. **The §5 gate distinguishes an act from a keystroke.** Submitting and cancelling redirect to
   the completion step (the member pressed a button). The draft autosave and the upload run from
   a timer and a file picker; they return `profile-incomplete` and the panel shows the step as a
   link — a redirect there loses the text the member is typing.
8. **The phone derives, refetches, and forgets.** Done-state is `done || localDone` (never
   seeded); `/me` is refetched on focus and its lifecycle is a pure reducer; a stale token signs
   out locally so the sign-in form appears; the previous member's card is dropped on sign-out.
9. **Hosts.** Production is `https://www.faseela24.com` (canonical) and `https://faseela.vercel.app`;
   both are trusted origins; the app's release profiles pin `EXPO_PUBLIC_API_URL` to the
   canonical host and the development profile leaves it to the Metro host.

## Consequences

- The landing's page-own JavaScript budget (ADR 0028 §7, 25 KB gzipped) now includes the
  session island; it is re-measured at every `next build` (First Load JS of `/`).
- Every visitor to `/` and `/masarat` makes one `GET /api/auth/get-session`; it is exempt from
  the limiter and costs one indexed query.
- Sign-in on a host other than `BETTER_AUTH_URL` still completes (trusted origin), but the
  emailed link always points at the canonical host — the owner keeps `BETTER_AUTH_URL` at
  `https://www.faseela24.com`.
- `pnpm verify:db` asserts `rate_limit` exists; the migration must run before a deploy of the
  new `auth.ts`, or every limited endpoint fails on the missing table.
