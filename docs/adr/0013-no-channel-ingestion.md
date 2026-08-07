---
status: accepted
date: 2026-08-07
supersedes: 0002-read-only-channel-aggregation
---

# The platform does not read from Channels; content is authored here

ADR 0002 planned scheduled ingestion from Telegram, Instagram and YouTube so the Feed would assemble
itself from work the Initiative had already published. That is withdrawn. The platform's Feed contains
only Announcements, Products and Events that an Editor published on the platform, and Channels appear
as outbound links.

## Why this changed

ADR 0002 named its own load-bearing risk — "each Channel needs a documented, ToS-compliant access path
before its ingestion ships" — and on investigation every path failed or cost more than it returned.

Telegram's Bot API cannot read history at all: a bot receives `channel_post` updates only from the
moment it is made a channel administrator, so the Initiative's deepest asset, its 3,000-message
archive, is unreachable, and even forward ingestion requires an administrator action on the
Initiative's own channel. Instagram's Graph API returns media only for the account that authenticated,
so ingesting @faseela_24 requires the Initiative's own Business credentials rather than anything the
build can provide. YouTube alone was clean — an API key and roughly ten quota units for a full channel
scan — but one source is not a Feed.

The common shape is the point: **all three depend on the Initiative granting access, not on writing
code.** Ingestion was therefore a dependency on a third party's cooperation sitting directly beneath
the platform's front page, and the front page cannot be blocked on a negotiation.

## Consequences

The Feed becomes simpler and stronger. It has one writer, so ordering, media handling and freshness
have a single owner, and no part of the product degrades when someone else's API changes its terms.
There are no scheduled workers, no queue, no Redis and no ingestion failure modes to monitor, which
also removes the strongest argument for a long-running service alongside the app.

The cost is real and should be stated plainly: content published to Telegram or Instagram does not
appear on the platform unless an Editor also publishes it here. That is double work for the
Initiative's media wing, and if it proves unsustainable the answer is a *publishing* tool that posts
outward from the platform — the opposite direction of travel from ADR 0002 — which would be a new ADR.

Because Feed content is now authored rather than cached, it is a copy of record. It must be backed up,
it must be editable, and it needs a human interface to create it. That makes the CMS question load
bearing where it was previously optional, and it is the reason `Cultural News`, `Initiative Activity`,
`Ingestion` and `Feed Item` have been removed from CONTEXT.md: the platform no longer distinguishes
content by where it came from, only by what it is.
