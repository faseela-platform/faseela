# 0025 — Authority is a role plus a track scope, enforced server-side

- **Status:** accepted
- **Date:** 2026-08-25
- **Decides:** how the admin dashboard authorises actions — who may manage what
- **Builds on:** [0023 — Editors are our own users](./0023-editors-are-our-own-users-payload-removed.md)

## Context

Slice 4 gives the team a back-office (§34) and introduces **track supervisors**
(§35): staff assigned to specific Tracks who may manage only those Tracks. Two
spec rules bind the design:

- §35 — a supervisor is assigned **manually** (never earned by Points) and manages
  their Track(s) only, unless the admin grants more.
- §36 — permissions must be enforced **at the system level, not by hiding UI**: a
  direct URL or API call a user is not allowed must be refused by the server. §36
  further *prefers* an independent named-capability system (create_task,
  review_task, edit_track … each bound to a level and scope).

The model so far (ADR 0023) is a single `user.role` — member / editor / admin —
which is **global**: an editor can review every Submission, everywhere. That does
not express §35's per-Track scoping.

## Decision

**Authority = a global role + a per-Track scope, enforced on the server.**

- `admin` is the central administration (§34): global, every capability, needs no
  scope row.
- `editor` is staff who may be **assigned** to specific Tracks through a
  `track_supervisor` join table (user × track, many-to-many — §35 allows several
  supervisors per Track and a supervisor several Tracks). An editor's authority is
  exactly the Tracks they appear against.
- `member` holds no staff authority.

The pure predicate `canManageTrackScope(role, supervisedTrackIds, trackId)` —
admin ⇒ any Track, editor ⇒ a Track in their scope, otherwise no — is shared by the
data layer and the web gates, the way `isStaffRole` already is. The web enforces it
with `requireAdmin()` (global acts: roles, tiers, supervisor assignment, creating a
Track) and `requireTrackAccess(trackId)` (a Track's Tasks and its Submissions).
Every `/idara` page and Server Action calls a gate as its first act, and
`reviewQueue` filters to the reviewer's supervised Tracks. The block is on the
server, not the button — §36's hard rule.

**The named-capability engine §36 "prefers" is deferred.** A permissions table
(capability × scope) with a `can(user, capability, scope)` resolver is the right
shape once many capabilities must be granted independently of the roles that hold
them. Today there are two axes — global admin, and track-scoped editor — and
building the engine now would be machinery ahead of need. Role + scope meets the
requirement; the engine layers on when a capability first needs to vary
independently of a role.

## Consequences

- A new `track_supervisor` table + `assignSupervisor` / `removeSupervisor` /
  `tracksSupervisedBy`. Assignment is a deliberate admin act (§35); the row cascades
  on user or track deletion because an assignment is *access*, not a *record* — the
  same distinction ADR 0016 draws between the credentials it deletes and the ledger
  it keeps.
- **`/muraja3a` changes.** The review queue, previously global to any editor, now
  scopes to supervised Tracks (admin still sees all): Slice 2's `reviewQueue` grows
  an optional `reviewerTrackIds`. A pleasant side effect — this narrows the deferred
  "an editor could accept their own work" exposure, since an editor only sees the
  Tracks they run.
- Three orthogonal concepts now stay cleanly separate: **role** (authority, granted
  — ADR 0023), **tier** (standing, earned — ADR 0024), and **scope** (which Tracks
  — this ADR). None is derived from another.
- When the capability engine arrives, `canManageTrackScope` and the two gates are
  the seam it replaces: the call sites already ask "may this user do this here",
  which is exactly what `can(…)` will answer.

## References

- [ADR 0023 — Editors are our own users](./0023-editors-are-our-own-users-payload-removed.md) — role as granted authority
- [ADR 0024 — A tier is lifetime standing](./0024-a-tier-is-lifetime-standing-not-seasonal-rank.md) — tier as earned standing, separate from role
- [ADR 0016 — Erasure anonymises](./0016-erasure-anonymises-it-does-not-delete.md) — why an assignment cascades (access) while the ledger restricts (record)
