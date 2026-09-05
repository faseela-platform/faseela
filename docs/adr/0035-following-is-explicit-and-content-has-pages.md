# 35. Following is explicit, and content has pages

Date: 2026-09-02

## Status

Accepted. Implements Slices 12+13 in one push (owner decision 2026-09-01, from
their own review of المواصفات §2/§3/§9–§15/§19/§30–§32). Supersedes the implicit
follow ADR 0027 leaned on.

## Context

The largest true v1 gap in the spec audit: متابعة المسار (§10) was a Phase-1 item
never built — notifications _guessed_ a Member's Tracks from where they had
worked — and a Track page showed only Tasks: no content tab (§13), no content
page (§14), no task↔content linkage (§15/§19/§42). Nine tracks were specified;
three existed. برامج التأهيل وهيئات الإنتاج had no structured representation.

## Decision

- **`track_follow`** (migration 0009, mirrors `track_supervisor`): the follow
  button on Track pages (§11: hidden once following; unfollow at the page foot),
  followed-first ordering on /masarat (§9 — the page went from ISR to
  per-request, a per-reader ordering no shared cache can hold), the home's
  zone 2 and the honest zone-5 اكتشف (§3), and THE notification audience for
  `track_update` — an unfollow is honoured absolutely.
- **Working in a Track follows it — first work only** (`followOnFirstWork`,
  called inside the attest/draft/submit transactions): the launch backfill's
  rationale made permanent, without making unfollow a lie for members who stay
  active. The migration backfills follows from all prior work.
- **Content pages**: `/muhtawa/[id]` (§14) with the piece's linked Tasks (§15
  path 1 — a Task links when its `content_scope` admits the item); the Track page
  grows المحتوى|المهام tabs (§13); scoped review Tasks get a content picker whose
  choice lands in `submission.content_id` (§15 path 2, §42) and shows in review.
  `content_scope` is §19's simplest honest form: null / "track" / a
  classification. No `book` entity: «سأقرأ الكتاب» keys off content with linked
  Tasks — flow over storage.
- **`body`** (§2's five برامج/هيئات, seeded in the migration): general content
  can say which body it speaks for (`content_item.body_id`), picked in /idara.
- **سجل أعمالي** (§30 addition, owner choice): completed work read from the
  LEDGER (the §8 source of truth), open submissions with their true states —
  on /hisabi and حسابي. Personal only; §30's social exclusions stand.
- The six remaining §2 Tracks stand as DRAFTS (`scripts/seed-draft-tracks.mjs`);
  supervisors publish when ready.

## Consequences

`/api/v1` grew: follow (POST/DELETE), tracks/:slug/content, content/:id, home,
record; `/me` carries `followedTrackIds`; the Track detail carries `trackId` +
`followerCount` (the reader's own state stays out of the cacheable response).
Task authoring gained the §19 scope on CREATE only — editing an existing Task's
scope arrives with Slice 14's task depth. db suite 182 → 190+ tests.

## Status note (2026-09-05)

Owner decision at the R3 code-review checkpoint: the follow affordance is **one
persistent toggle on both platforms** — the following state is itself the unfollow
button («تتابع هذا المسار ✓»), tapped/clicked to leave. This supersedes the earlier
reading of §11 (hide the button once following; unfollow at the page foot): mobile
already behaved this way, and the web now matches it. The auto-follow-on-first-work
rule and its unfollow supremacy are unchanged.
