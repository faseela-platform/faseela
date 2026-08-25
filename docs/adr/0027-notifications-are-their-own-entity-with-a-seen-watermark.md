# 0027 — Notifications are their own entity, read against a seen-watermark

- **Status:** accepted
- **Date:** 2026-08-25
- **Decides:** how notifications (§38) are modelled, how "already seen" is tracked, and where they are raised
- **Builds on:** [0026 — Content is one entity; the home page is a read](./0026-content-is-one-entity-and-the-home-is-a-read.md); [0024 — A tier is lifetime standing](./0024-a-tier-is-lifetime-standing-not-seasonal-rank.md); [0015 — Points are an append-only ledger](./0015-points-are-an-append-only-ledger.md)

## Context

§38 asks for notifications tied to important events: a submission accepted, returned
or finally rejected; points credited; a new capability opened; an important update to
a Track the Member follows; an app update; an announcement or event. It adds two
constraints that shape the design as much as the list does — **«لا يجب تحويل كل تحديث
صغير إلى إشعار»** (not every small change earns an interruption) and **«الإشعارات يجب
أن تكون قابلة للإدارة من لوحة التحكم»**. §3 supplies the reading rule: show an update
from time to time, *not* on every login, because the system knows it was already seen.

Most of that list is **per-member and event-driven** — it happens *to* someone at a
moment. Only the last two are broadcasts an admin composes.

## Decision

**A `notification` table of its own, not another `content_item` type.** ADR 0026 made
content a single entity because every one of its types is the same thing: a public,
stateless card in a reverse-chronological feed. A notification is none of those —
it is *addressed*, it carries *per-reader* state, and it drives a badge. Same-shaped
columns, different behaviour, so a different table. The two connect through the link a
notification points at, not by being merged.

**A nullable `user_id` is the targeting axis.** Set, it is a per-member event, inserted
already `published` because the event has happened and there is nothing to draft. Null,
it is a broadcast, drafted and then published like a Track or a content piece. One
table serves both halves of §38 without a second entity.

**Seen-state is one timestamp on the Member (`last_notifications_seen_at`), not a join
table.** Unread is "published after that moment"; opening the list moves it forward.
This is what makes §3's rule cheap: a broadcast to a thousand Members writes one row
rather than a thousand read-receipts, and the badge is one indexed count. `default
now()` is load-bearing — someone who joins today starts caught up instead of meeting
every notice the initiative ever sent. Marking uses `greatest(current, now)` so a
late-arriving request cannot drag the mark backwards and resurrect dismissed notices.

The cost is honest: a watermark cannot express "dismiss just this one". Nothing in §38
asks for that; if it is ever wanted, a `notification_read` join is an additive change
that needs no migration of the watermark.

**Events are raised inside the transaction that causes them.** `emitNotification` takes
a `Queryable`, so acceptance and the notice of acceptance commit together or not at
all: no Member is told about work that was then rolled back, and no acceptance goes
unannounced because a later write failed. Tier promotion (§38's «فتح صلاحية جديدة») is
detected the same way — the tier stays derived, never stored (ADR 0024), so the
question "did this award cross a threshold" is answered by comparing the total before
and after inside that same transaction.

**The enum is the whole list of reasons we may interrupt someone.** That is the
mechanism for §38's «لا كل تحديث صغير»: adding a reason means adding an enum value,
which is a decision someone has to make deliberately rather than a line of code
somewhere raising a notice on a whim.

**App updates stay in both the feed and the bell** (owner's call). `app_update` remains
a `content_item` type rendering in `/mustajaddat`, and a notification may announce the
same change. Nothing already shipped changes.

## Consequences

One table, two provenances, one read path — a Member's bell is a single query over
"mine or everyone's", and the badge is a count over the same predicate. Because the
member read is `published`-only, unpublishing or archiving a broadcast withdraws it
from every bell, which is the closest thing to a recall that a read notice allows.

Push delivery (Expo Push → FCM/APNs, Web Push) is deliberately not part of this: it is
a *channel* over these same rows, and it needs EAS builds and platform credentials
that do not exist yet. Building the in-app layer first means that work is later purely
additive.
