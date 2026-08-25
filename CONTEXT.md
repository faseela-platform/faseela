# Faseela Platform

The digital home of مبادرة فسيلة — a Lebanese cultural initiative. One platform (web + iOS + Android) that gathers the initiative's scattered cultural work into a single place, turns cultural consumption into small actionable tasks, and rewards the effort.

Terms below are the canonical vocabulary for code, tickets, ADRs, and conversation. Arabic is the source language of the domain; the English term is what appears in identifiers.

## Language

### The initiative

**Initiative** (المبادرة):
فسيلة itself — the organisation whose work this platform serves. Singular; there is exactly one.
_Avoid_: organisation, NGO, client, company

**Wing** (جناح):
One of the five standing organisational units the Initiative is structured into.
_Avoid_: department, division, team

**Circle** (دائرة استهداف):
One of the seven concentric audience bands the Initiative targets, from its own core outward to the general public. Determines who content is aimed at, not who may read it.
_Avoid_: segment, audience group — and do not confuse with a **Tier** (a Member's earned permission level; a Circle is targeting, not standing).

### Content and journeys

**Track** (مسار):
A themed, long-running cultural journey with its own page, products, and events — the primary unit of programming. A Track is the parent of Tasks.
_Avoid_: path, course, program, journey, series

**Task** (مهمة):
A small, concrete cultural action a Member performs while consuming content, worth a fixed number of Points on completion. "Summarise chapter one in three lines", "design a quote image and publish it". Tasks are what distinguish this platform from a content library.
_Avoid_: challenge, quest, activity, mission, assignment

**Submission**:
What a Member sends in to complete a Task — text, an image, a link, a file. Awaits Review.
_Avoid_: entry, answer, response, upload

**Review**:
An Editor's decision on a Submission: accepted, rejected, or returned for revision. Accepting a Submission is what mints its Points.
_Avoid_: approval, moderation, grading

**Content** (محتوى):
The unified entity behind the Feed and home page (§33): one record for every published piece — an Announcement, a Product, an Event, News, or general cultural material — distinguished by its **type**, not modelled as a table each (ADR 0026). Content may belong to a Track or be **track-less** (general Faseela content). One entity, one publish lifecycle (the same `published_at` rule as a Track). Product, Announcement and Event below are *types* of Content, kept as distinct semantic terms.
_Avoid_: post, article, item, feed item — and do not give Announcement/Product/Event separate tables.

**Product** (منتج):
A finished cultural artefact the Initiative published — a book summary, a podcast episode, a video, a poster. Lives under a Track.
_Avoid_: content item, asset, resource, material

**Event** (فعالية):
A gathering, in person (حضوري) or online (مجازي), with a time and a place. Past Events are archive; future Events are what Announcements point at.
_Avoid_: activity, meetup, session

**Announcement** (إعلان):
A short notice about something upcoming. Editorial, time-bound, and always points at an Event or a Track.
_Avoid_: news, post, notice, banner

### The feed

**Feed** (الصفحة الرئيسة):
The platform's front page: a **personalized read** (§3, §43), not authored sections. For a signed-in Member it opens with their own tasks and progress, then a single merged, reverse-chronological stream of published **Content** (Announcements, Products, Events, News, the cultural scene) — "do not split into many sections" (§3). A visitor sees the stream and a sign-in prompt on gated actions. Everything in the stream is authored on the platform — see ADR 0013 — and assembled per request (ADR 0026); it renders at its own route, leaving the static marketing landing at `/` (ADR 0011) untouched.
_Avoid_: home, timeline, stream, dashboard

**Channel**:
An external platform the Initiative publishes on — Telegram, Instagram, YouTube, TikTok, Facebook. The platform **links out** to Channels and never reads from or writes to them programmatically.
_Avoid_: social account, integration, platform, network

### People and progress

**Member** (مشترك):
A registered person who follows Tracks, completes Tasks, and earns Points.
_Avoid_: user, participant, subscriber, customer

**Editor**:
A Member with a staff role who reviews Submissions and, when assigned as a **Supervisor**, manages that Track's Tasks and content. Staff is granted by an Admin, never earned by Points (ADR 0023). Two or three people in practice.
_Avoid_: admin, moderator, content manager

**Supervisor** (مشرف المسار):
An Editor the central Admin has assigned to a Track (§35). They manage that Track — its Tasks, its content, its Submissions — and no other, unless assigned more. Assignment is a deliberate act, never automatic from Points; a Track may have several Supervisors. Scope, layered on the staff role (ADR 0025).
_Avoid_: owner, moderator, manager

**Admin** (الإدارة المركزية):
The central administration (§34): the global staff role with authority over every Track, Member, role, tier threshold, and setting. Distinct from a Supervisor, who is scoped to their own Track(s).
_Avoid_: superuser, root, owner

**Point** (نقطة):
The unit of earned cultural effort, minted only by an accepted Submission. Never spent, never transferred — Points are a record, not a currency.
_Avoid_: score, XP, credit, coin, reward

**Season** (موسم):
A fixed window with a start and an end during which Points accumulate toward a Leaderboard and prizes. Points earned in one Season never carry into the next.
_Avoid_: competition, event, cycle, sprint, contest

**Leaderboard** (لوحة الصدارة):
The ranking of Members by Points earned within one Season. Always scoped to a Season; a lifetime ranking is a different thing and does not exist.
_Avoid_: ranking, standings, top list

**Tier** (رتبة):
A Member's standing on the permission ladder — زائر → عام → خاص → متقدم → فسيلي — reached by accumulating Points and unlocking capabilities as it rises (spec §45–49). Derived on read from **lifetime** Points (all Seasons), so unlike the season-scoped Leaderboard a Tier only ever climbs; it is never demoted by a Season ending. See ADR 0024. Distinct from a **Role** (authority: member/editor/admin, granted) and from a **Circle** (who content is aimed at). The thresholds are Admin-editable (§46).
_Avoid_: role, level, rank, Circle

**Progress** (التقدم):
A Member's current Tier, lifetime Points, and how far the next Tier is — what the profile page (`/hisabi`) shows (spec §48 Phase 1). The read is `memberProgress`.
_Avoid_: standings, score, ranking

**Service Request** (طلب خدمة):
An inbound approach from outside the Initiative — a volunteering offer, a suggestion, or a request for scholarly, technical, or media support.
_Avoid_: contact form, ticket, inquiry, lead

### Commerce

**Catalogue**:
The browsable list of physical items the Initiative offers. Display only — it holds no cart, no prices to be charged, and no payment.
_Avoid_: shop, store, e-commerce

**Order Intent**:
A Member's expression of interest in a Catalogue item, handed off to WhatsApp for a human to complete. No money moves through the platform.
_Avoid_: order, purchase, checkout, cart
