# 0021 — Attest completion mints Points without a reviewer

**Status:** Accepted
**Date:** 2026-08-07
**Supersedes:** none
**Related:** 0016 (erasure anonymises), 0018 (magic links), 0019 (seed provenance)

## Context

The ledger had no writer. A Member could read Tracks and Tasks but could not
complete anything, so `point_award` stayed empty and the Leaderboard had no input.
Abdullah's instruction was to ship as fast as safely possible, and the `attest`
path is the half of task completion that needs no Editor queue: the Member declares
a checkable thing done, and the Points mint immediately.

`completion_mode` already split Tasks into `attest` and `review` (ADR 0009), so
this decision is about how the `attest` half behaves, not whether the split exists.

## Decision

**An `attest` completion writes an accepted `submission` with no reviewer, and a
`point_award` in the same transaction.**

The Submission row exists even though the Member submitted nothing. It is the
join between a Task and the award, and `point_award.submission_id` is `NOT NULL` —
minting a bare award was never possible. Its `body` is null, because there is
genuinely no evidence.

**`reviewed_by` and `reviewed_at` stay null.** Recording the Member as their own
reviewer would be the convenient lie: it would satisfy a naive "accepted rows have
a reviewer" expectation while making every future count of Editor workload wrong.
An attested Task was examined by nobody, and the row says so.

**The Member id is never accepted from the client.** The Server Action reads it
from the session. A `userId` parameter would let any Member mint Points into
another Member's ledger, and on a Leaderboard awarding points to a rival is as
damaging as awarding them to yourself.

**Completion is idempotent, enforced by the database rather than by the UI.**
`submission_task_user_unique` means a second attempt finds the existing row and
returns `already-completed` rather than minting again. The button also disappears
after success, but that is a courtesy — the guarantee is the constraint, because
a double-tap on a slow connection races past any amount of client state.

**Both success paths revalidate the cache.** `already-completed` is not a no-op
from the page's point of view: the reason a Member taps twice is usually that the
first response was lost, and their cached page still shows the Task as incomplete.

## Consequences

The Leaderboard is live. Five `attest` Tasks across three Tracks can be completed
today, worth 20 to 40 points each.

`review` Tasks show a sentence rather than a disabled button. A greyed-out control
reads as broken; a sentence reads as not yet built. The two documented 50-point
Tasks are `review` mode and therefore not yet completable — the single largest
piece of the product still missing.

Attested completion is unverifiable by construction. A Member can claim a session
they did not attend. This is accepted deliberately: the alternative is an Editor
queue in front of every trivial Task, which is exactly the friction that kills
participation in a volunteer initiative. Points are Season-scoped and Seasons are
two months (ADR 0019), so a dishonest total expires rather than compounding.

The Track detail page is now `force-dynamic` and mounts the codebase's first
public client component. ADR 0011's zero-JavaScript rule survives for the landing
page and the Tracks index; it cannot survive a mutation with three outcomes that
must not reload the page.

## Verification

`pnpm verify:journey` walks the whole thing against the running app and live Neon:
sign in by magic link, load the Track, invoke the real Server Action through its
`Next-Action` id extracted from the served bundle, then assert on the database and
on the rendered Leaderboard. 26 checks.

It asserts the negative cases too — that a signed-out visitor is offered sign-in
and _not_ a completion button, that the anonymous and authenticated bodies differ
(proving no shared cache), and that an anonymous visitor sees the ranking without
a personal standing.

Invoking the Server Action rather than calling `attestTask` directly is the point.
The helper has its own unit tests; what had never run was the session read, the
refusal translation and the revalidation.

**The extraction was initially wrong in a way worth recording.** Matching bare
`.js` substrings in the HTML finds Turbopack's inline references and misses the
real `src="..."` script tags, so the check reported "action not found" while the
action was mounted and working. The id is also 42 hex characters in this Next
version, not the widely-documented 40. Both mistakes produced a _failing_ test
against correct code — the safe direction, but it cost a debugging cycle, and a
looser pattern (`{20,}`) now prevents a future id-width change from silently
turning the assertion into a no-op.
