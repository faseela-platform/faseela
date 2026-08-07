# 15. Points are an append-only ledger with frozen values

Date: 2026-08-07

## Status

Accepted

## Context

Members earn Points by completing Tasks, and Leaderboards rank them within a
Season. The obvious implementation is a `points` integer on the member row,
incremented on completion. It is one column, one write, and every read is free.

Three things make it wrong here.

An Editor will eventually change a Task's worth — that is ordinary editorial
work, not an unlikely event. If Points are read through a join to `task.points`,
raising a Task from 5 to 10 silently rewrites what every past Member earned, and
a Leaderboard reorders itself although nobody did anything.

Seasons partition history. CONTEXT.md: Points earned in one Season never carry
into the next, and "a lifetime ranking is a different thing and does not exist."
A single running total cannot answer "how many Points in Season 2" at all.

And Submissions can be reviewed twice. A double-clicked accept button, a retried
request, or two Editors accepting the same Submission concurrently must not mint
twice — and an increment is exactly the operation that cannot detect that it has
already happened.

## Decision

**Points are rows in an append-only `point_award` ledger, never a mutable total.**

Each row records the Member, the Submission that caused it, the Task, the Season,
the value, and when. Totals are always computed with `sum()` over a Season.

**The value is copied from `task.points` at award time and never read through the
join afterwards.** What a Member earned is a historical fact about the moment
they earned it.

**The Season is resolved once at award time and stored**, rather than derived
from `awarded_at` on every read. Deriving it would mean an Editor correcting a
Season's dates retroactively moves Points between Seasons.

**Idempotency is a unique index on `submission_id`, not an application check.**
A read-then-write guard is a race: two concurrent accepts both observe no award
before either writes. `awardPoints` inserts with `onConflictDoNothing` and, on
conflict, returns the existing award — so a retry is indistinguishable from the
first call except in its reported status.

Foreign keys to Task, Submission and Season are `restrict`, not `cascade`.
Deleting a Task must not erase the record that a Member did the work; Tasks are
archived instead.

## Consequences

Reading a total costs an aggregate instead of a column read. This is a real cost
and it is bounded: `point_award_season_user_idx` covers it, and the largest
plausible volume — roughly fifty thousand Members times a few hundred Tasks — is
small for Postgres. If Leaderboard reads ever become hot, the answer is a
materialised view refreshed on a schedule, which the ledger makes possible and a
running total would not.

The ledger is auditable, which matters more than the performance question: for
any Member, every Point is traceable to the Submission and reviewer that minted
it. A disputed Leaderboard can be answered with evidence rather than assertion.

Corrections must be made as new rows or explicit deletions of specific awards,
not by adjusting a number. There is currently no negative-award path; if Points
ever need to be revoked, a compensating row is preferable to a delete because it
preserves the history, and that will need its own decision.
