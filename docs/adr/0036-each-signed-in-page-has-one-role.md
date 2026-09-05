# 36. Each signed-in page has one role

Date: 2026-09-03

## Status

Accepted (owner decision 2026-09-03, during the R3 local checkpoint). Deliberately
departs from §3.1 in one respect — recorded here so it reads as a decision, not drift.

## Context

R3's home zones made the overlap visible: /mustajaddat opened with a personal card
(name, tier, points, gold progress bar, open work) that duplicated the top of
/hisabi almost line for line. The owner's review question — «i see they have things
in common» — was right: two pages were answering «how am I doing؟», and none of the
duplication earned its place. §3.1 does put «مهامك الحالية وتقدمك» on the home, which
is why the card existed; §30 gives the profile the same facts.

## Decision

Four pages, four sentences, no overlap:

- **/** — the public landing. Marketing only, static.
- **/mustajaddat** — _what's happening_: followed Tracks with their latest word
  (§3.2), the merged stream (§3.3/§3.4), discovery (§3.5). **No personal card at
  all** for a signed-in Member; a visitor still gets the §43 sign-in prompt.
- **/hisabi** — _who I am_: tier, points, progress-to-next, per-track breakdown,
  سجل أعمالي (completed + open work), sign-out. The ONLY home of personal state.
- **/ishaarat** — _addressed to me_: targeted events (قبول، نقاط، رتبة) and
  broadcasts, with the unread watermark. Distinct from the stream: the stream is
  the same public content for everyone; the bell is personal and read-once.

The nav keeps the small tier badge beside the name everywhere — a badge is
identity, not a page role.

The departure: §3.1's tasks-and-progress zone is **not rendered on the home**. Its
facts live at /hisabi (سجل أعمالي's أعمال مفتوحة already lists open work). If the
home ever needs a pull toward unfinished work, the shape is a one-line action strip
(`memberHomeTasks` stays exported and tested for exactly that) — never the full
progress card again.

The mobile app already conformed: its home tab renders zones + stream only, and
personal state lives on the حسابي tab.

## Consequences

- /mustajaddat renders the same body for every signed-in Member (only the nav
  differs) — simpler, and one less place for personal numbers to disagree.
- `memberHomeTasks` has no product caller (tests keep it honest); it is the seam a
  future action strip would use.
- Any new personal fact (streaks, badges) goes to /hisabi first; the home gets at
  most a link.
