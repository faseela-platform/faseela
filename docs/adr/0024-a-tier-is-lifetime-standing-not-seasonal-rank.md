# 0024 — A tier is lifetime standing, not seasonal rank

- **Status:** accepted
- **Date:** 2026-08-24
- **Decides:** what Points a Member's permission tier is computed from, and where the tier lives
- **Builds on:** [0015 — Points are an append-only ledger](./0015-points-are-an-append-only-ledger.md); CONTEXT.md's season-scoped Leaderboard

## Context

Slice 3 introduces the permission ladder (spec §45–49): accumulated Points unlock
Member tiers (زائر → عام → خاص → متقدم → فسيلي) that gate capabilities. This meets an
existing rule head-on. The Leaderboard is **season-scoped** — its own code is
explicit that "a lifetime ranking is a different thing and does not exist"
(`leaderboard.ts`), and CONTEXT.md says Points belong to exactly one Season and
never carry into the next. If a tier were season-scoped too, a Member would fall
from فسيلي back to زائر at every Season rollover, losing capabilities they had
earned — which is the opposite of §49's "تراكم نقاطه → تفتح له قدرات جديدة" (his
Points accumulate → new capabilities open to him).

Separately, ADR 0015 forbids storing a derived value: a total kept as a column
drifts from the ledger that is its source of truth. A tier is a derived value.

## Decision

**A tier is computed from LIFETIME Points; the Leaderboard stays season-scoped.**
These are two different questions asked of the same ledger:

- **Ranking** (Leaderboard) — "who did the most _this Season_" — resets each
  Season. It is motivation, and it is a contest.
- **Standing** (tier) — "how far has this Member come, _ever_" — only ever climbs.
  It is permission, and it is a record.

`memberLifetimePoints` sums the ledger with no Season filter; `seasonLeaderboard`
keeps its `where seasonId = …`. CONTEXT.md's prohibition is on a lifetime
_Leaderboard_ — a ranking — which still does not exist. A lifetime _sum for
standing_ is a different thing, and it is what a permission ladder requires.

**The tier is derived on read, never stored.** `memberProgress` computes it from
lifetime Points against the thresholds on every call (ADR 0015). What _is_ stored
is the `member_tier` ladder — the tiers and each one's `min_points` — because §46
makes those thresholds an **Admin-editable setting**, not a constant. Editing a
threshold re-tiers every Member on their next read, with no migration and no
backfill. This is the first Admin-editable setting in the schema.

**A tier is distinct from a role.** `user.role` (member/editor/admin) is
_authority_, conferred by a deliberate act (ADR 0023). A tier is _standing_, earned
by doing the work. The two never conflate: an Editor is staff whatever their tier;
a فسيلي Member is not staff.

## Consequences

- A new class of aggregation exists — `memberLifetimePoints` and
  `memberTrackPoints`, the first ledger reads _not_ scoped to a Season. The
  per-track join is served by a new `point_award(user_id, task_id)` index.
- The capabilities a tier unlocks are Phase 2/3 (§48) and not built yet. Slice 3
  ships the ladder and a profile (`/hisabi`) that shows it; the enforcement seam
  (`requireTier`) is written when the first gated feature arrives, not before —
  there is nothing member-facing to gate today (you _do_ tasks to _earn_ the
  Points that climb, so task completion stays open to everyone).
- Standing is monotonic in time: a Member is never demoted because a Season ended.
  The one way a Member can drop a rung is an Admin _raising_ a threshold above
  their current Points — an accepted, deliberate consequence of editable
  thresholds (§46), not an automatic one.
- Slice 4's admin edits `member_tier` rows; the exact §45–47 names and thresholds
  are data seeded with working defaults (زائر 0 / عام 100 / خاص 200 / متقدم 500 /
  فسيلي 1000), refined by a settings edit rather than a code change.

## References

- [ADR 0015 — Points are an append-only ledger](./0015-points-are-an-append-only-ledger.md) — why the tier is derived, not stored
- [ADR 0023 — Editors are our own users](./0023-editors-are-our-own-users-payload-removed.md) — role (authority) is separate from tier (standing)
