# 0026 — Content is one entity; the home page is a read

- **Status:** accepted
- **Date:** 2026-08-25
- **Decides:** how the platform's content (§33) is modelled, and what the الصفحة الرئيسة / home (§3, §43) is
- **Builds on:** [0013 — No channel ingestion](./0013-no-channel-ingestion.md); [0023 — Editors are our own users, Payload removed](./0023-editors-are-our-own-users-payload-removed.md); [0025 — Authority is role plus track scope](./0025-authority-is-role-plus-track-scope-enforced-server-side.md); [0024 — A tier is lifetime standing](./0024-a-tier-is-lifetime-standing-not-seasonal-rank.md)

## Context

Slice 5 builds the front page the spec calls الصفحة الرئيسة (§3), fed by content
authored on the platform (ADR 0013 — the initiative writes here, it does not ingest
from Channels). Two questions had to be settled before writing a table.

**What is a piece of content?** CONTEXT.md names Announcement, Product and Event as
distinct concepts, and the original roadmap sketched them as three tables authored in
Payload. But Payload is gone (ADR 0023), and §33 does not describe three things — it
describes **one** content model, identified *by* its attributes: a type, a source, a
Track (if any), a classification, an availability degree, a task link (if any), a
publish date, a publish state, and the body that created it. The Feed (§3) then merges
"news, events, productions, announcements, track launches, app updates" into one
stream and says explicitly: *do not split them into many sections.*

**What is the home page?** §3 orders it — the Member's own tasks and progress first,
then followed tracks, then the merged updates stream, then the wider cultural scene,
then discovery — and §43 layers it by user state (visitor → general → special →
advanced). It is not a table of authored sections; it is a **personalized read** over
existing data, assembled per request.

## Decision

**One polymorphic entity.** A single `content_item` table carries every kind,
discriminated by a `content_type` enum (`announcement`, `product`, `event`, `news`,
`cultural`, `app_update`). Announcement/Product/Event/News/Cultural remain *semantic*
domain terms in CONTEXT.md, but they are **types of one entity**, not tables. This
makes the Feed a single ordered query rather than a union of three, and gives content
one CRUD surface in `/idara`, one publish lifecycle, one media path.

**It reuses the Track/Task shape exactly.** Same `publish_state` enum, same
`published_at` biconditional CHECK (published ⇔ has a date), same result-union writes —
so publishing content behaves identically to publishing a Track, and a supervisor who
can author a Track's Tasks can author its content. `track_id` is **nullable**: content
may be track-less general Faseela content (§33), and authoring track-less content is
**admin-only** (there is no Track owner to scope it to — ADR 0025).

**Availability is modelled now, enforced later.** §33 requires a `درجة الإتاحة`
(availability degree), and §43 gives special/advanced Members level-gated content. The
`min_tier` column ships now because the spec lists it as part of the model, but the
first content is public and the read does not yet filter on it: the `requireTier`
enforcement seam deliberately held since Slice 3 (ADR 0024's neighbourhood) is built
when special content actually exists, not before — the same YAGNI line drawn there.

**The home is a read, not a section-builder.** الصفحة الرئيسة assembles from
`feedItems` (published content, newest first) plus `memberHomeTasks` + `memberProgress`
for the signed-in Member's zone (§3.1). It lives at its own route; the crafted static
marketing landing at `/` (ADR 0011) is untouched. This slice builds Zones 1, 3 and 4;
Zone 2 (followed tracks) needs a Member→Track follow relationship that does not exist
yet, and Zone 5 (discovery) the spec itself defers — both are named deferrals, not gaps.

## Consequences

The Feed is one query and content is one form, which is the cheapest correct shape and
the one §33 asks for. The cost is that a `content_type` value carries meaning code must
respect (an `event` uses `event_at`/`event_place`; a `product` expects a Track), which
is convention, not a constraint — the same trade the `task.mode` enum already makes.
Adding a kind later is an enum `ADD VALUE`, not a new table. Because the home is a read,
it stays truthful as content and progress change, with nothing to keep in sync.
