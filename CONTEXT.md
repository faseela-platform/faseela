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
_Avoid_: segment, tier, audience group

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
The platform's front page: one merged, reverse-chronological stream assembled from Cultural News, Initiative Activity, and Announcements.
_Avoid_: home, timeline, stream, dashboard

**Cultural News** (الأخبار الثقافية):
Notable cultural happenings in the wider Lebanese resistance environment, including those the Initiative had no hand in.
_Avoid_: external news, third-party content

**Initiative Activity** (أنشطة فسيلة):
Notable things the Initiative itself did, across all Tracks.
_Avoid_: our news, internal posts

**Channel**:
An external platform the Initiative publishes on — Telegram, Instagram, YouTube, TikTok, Facebook. A source, never a destination: the platform reads Channels and never writes to them.
_Avoid_: social account, integration, platform, network

**Ingestion**:
The scheduled read of a Channel that turns its recent posts into Feed Items. Runs on a timer, never on request.
_Avoid_: sync, scrape, import, crawl

**Feed Item**:
The platform's own record of one post that exists on a Channel — its text, its media reference, its timestamp, and the deep link back to the original. Content is referenced and cached for display; the Channel remains the only copy of record.
_Avoid_: post, entry, cached post, mirror

### People and progress

**Member** (مشترك):
A registered person who follows Tracks, completes Tasks, and earns Points.
_Avoid_: user, participant, subscriber, customer

**Editor**:
A Member of the Initiative's staff who publishes Products, Announcements and Events, and Reviews Submissions. Two or three people in practice.
_Avoid_: admin, moderator, staff, content manager

**Point** (نقطة):
The unit of earned cultural effort, minted only by an accepted Submission. Never spent, never transferred — Points are a record, not a currency.
_Avoid_: score, XP, credit, coin, reward

**Season** (موسم):
A fixed window with a start and an end during which Points accumulate toward a Leaderboard and prizes. Points earned in one Season never carry into the next.
_Avoid_: competition, event, cycle, sprint, contest

**Leaderboard** (لوحة الصدارة):
The ranking of Members by Points earned within one Season. Always scoped to a Season; a lifetime ranking is a different thing and does not exist.
_Avoid_: ranking, standings, top list

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
