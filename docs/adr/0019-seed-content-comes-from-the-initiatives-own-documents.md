# 0019 — Seed content comes from the Initiative's own documents, and gaps stay visible

- **Status**: accepted
- **Date**: 2026-08-07
- **Supersedes**: none
- **Related**: [0015](0015-points-are-an-append-only-ledger.md), [0016](0016-erasure-anonymises-it-does-not-delete.md)

## Context

The database was empty, so the Track page had nothing to render. Two source
documents describe the Initiative:

| Document                           | Pages | What it covers                                                          |
| ---------------------------------- | ----- | ----------------------------------------------------------------------- |
| `الملف التعريفي لمبادرة فسيلة.pdf` | 17    | Identity, principles, five-year plan, organisational structure, martyrs |
| `تطبيق فسيلة.pdf`                  | 4     | The app's sections, task mechanics, gamification, budget                |

The choice was between seeding from these documents or inventing plausible
placeholder content. Placeholder content is faster but hides the questions that
real content forces open — whether a Task's points are fixed, whether a Task can
be repeated, who verifies a completed Task. Those are product decisions, and a
seed built on invented data lets them stay unasked until they are expensive.

## Decision

**Seed only what the documents state, cite every row to its source in the seed
script, and leave documented gaps empty rather than filling them.**

### What the documents establish

**A Season is two months.** `الملف التعريفي` p.13, the first policy of the
five-year plan:

> ضبط الموضوعات الثقافية ضمن قوالب فصلية، بحيث نختار موضوعًا كل شهرين ونعالجه
> بكل الوسائل الممكنة. هذا الموضوع يكون موضوعًا من خطة العام، ولا يكون منطلقًا
> من التفاعل مع الأحداث الجارية إلا إن طلبت الأحداث بشكل لا يمكن تجاهله (كالحرب مثلًا).

Corroborated on p.12 describing المشاريع الثانوية: _نختار موضوعًا في بداية كلّ
شهرين_. This resolves an apparent contradiction: `تطبيق فسيلة` p.3 mentions
daily, weekly and monthly rhythms, and p.4 requires a monthly prize budget. Those
are **tally and prize cadences inside a two-month themed Season**, not competing
Season lengths. Seasons are therefore seeded as calendar-aligned two-month blocks.

**Three Tracks.** `الملف التعريفي` p.14, under the مسارات العمل wing, names
مجموعات القراءة، البلاغ المبين، حتى يسمع كلام الله — prefixed _وهي من قبيل_,
which makes the list explicitly non-exhaustive. Abdullah confirmed these three
are the current Tracks. Two carry the memory of a martyr (p.15): مجموعات القراءة
is tied to الشهيد القارئ محمد علي فران, and البلاغ المبين to الشهيد التعبوي حسين
نور الدين. That is recorded in each Track's summary because it is the Track's
meaning, not decoration.

**One point value.** `تطبيق فسيلة` p.3 contains the only number in either
document:

> مثلًا: مهمة القراءة: لخص الفصل الأول من هذا الكتاب في 3 أسطر لتحصل على 50 نقطة،
> ومهمة الإعلام: صمم صورة اقتباس من كلام السيد القائد وانشرها.

Fifty points for the reading summary; no value given for the media task.
Abdullah confirmed 50 still holds.

**Two Task shapes.** Same page: a Task is either a resource the Member needs
(_مورد حاجة_) or a consolidation of what was already read (_تثبيت وتعميق_), and
must be _بسيطة وممتعة_.

### What was derived, and by what rule

Point values for Tasks the documents do not price follow one stated rule: **a
Task requiring produced work is worth the documented 50; a Task requiring only
attendance or consumption is worth 20.** Two values, one of them documented, and
the rule is written where an Editor can disagree with it. The alternative — a
five-tier scale invented wholesale — would look more considered while resting on
nothing.

`mode` follows `completion_mode`'s existing contract: `attest` where the Member
can only declare (attending a discussion), `review` where an Editor must accept
work (a three-line summary, a designed quote image).

### What was left empty

**حتى يسمع كلام الله is seeded with no Tasks.** Neither document describes any.
Inventing them would put words in the Initiative's mouth about its own
programme. It renders as a published Track with an empty Task list — an honest
state the Track page must handle regardless, and better discovered now.

Its summary stays close to the Qur'anic phrase the title quotes (التوبة ٦)
rather than asserting activities no document describes. Flagged for rewriting.

### Repeatability

`submission` carries `UNIQUE (task_id, user_id)`, so **a Task can be completed
exactly once.** The documents' own example — _لخص الفصل الأول_ — is
single-completion by construction, and a reading Track wanting per-chapter
progress models each chapter as its own Task.

Abdullah left this call to the implementation. We keep the constraint, because
relaxing it would make the ledger's idempotency guarantee negotiable: the
`UNIQUE (submission_id)` on `point_award` mints exactly one award per accepted
Submission, and that only bounds a Member's earnings from a Task while
Submissions per Task per Member are also bounded. A repeatable Task needs a
per-Task repeat policy, a submission counter, and a rule for what a second
acceptance is worth — three new concepts, none of which any document asks for.
Editors creating a Task per chapter is manual but truthful; the cost is bounded
by chapters, and Payload's duplicate action makes it cheap.

### Outside contributions deferred

`تطبيق فسيلة` p.3 says the tally includes cultural work done outside the
Initiative:

> هذه المسابقة تشمل الجهود الفردية من فسيلة وغيرها ... والمساهمات ذات الطابع
> الثقافي في جهات غير فسيلة

This requires a self-reported award path, where a Member claims Points for work
no Editor witnessed. Abdullah deferred it. Recorded here because the schema does
not currently admit it: every `point_award` requires a `submission_id`, so there
is no way to mint Points without a Submission. Supporting outside contributions
later means either a nullable `submission_id` — which would weaken the
idempotency index — or a Submission with a distinct mode representing a claim.
The second is preferable and should be an ADR of its own.

## Consequences

The seed is idempotent: Tracks and Seasons upsert on `slug`, Tasks on
`(track_id, position)`. Re-running never duplicates, and `published_at` is
preserved via `coalesce` so a re-seed does not rewrite publication dates.

`verify-seed.mjs` asserts the content by exact string comparison against
expected Arabic. This exists because the Windows console renders Arabic as
mojibake — `مجموعات القراءة` printed as `┘à╪¼┘à┘ê╪╣╪º╪¬` — and console mangling is
visually indistinguishable from real corruption. Byte comparison in a script is
the only trustworthy check. It also asserts the 50-point anchor specifically, and
that a Season contains the current instant, since otherwise `currentSeason`
returns null and `awardPoints` silently refuses to mint while everything looks
healthy.

Four content questions remain open and are the Initiative's to answer, not ours:
the theme of the current Season, a description and Tasks for حتى يسمع كلام الله,
point values if the 20/50 rule is wrong, and whether outside contributions are in
scope for the first release.

## Notes

`insert ... values ($4::publish_state, ... case when $4::publish_state = ...)`
carries an explicit cast. Used bare, the same parameter is inferred as the enum
in one position and as `text` in the other, and Postgres rejects the statement
with _inconsistent types deduced for parameter $4_. This is standard behaviour
for repeated parameters in differing contexts, documented under
[PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html): parameter
types are resolved once for the whole statement.
