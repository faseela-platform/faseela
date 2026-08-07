---
status: superseded
superseded-by: 0013-no-channel-ingestion
date: 2026-08-06
---

# Channels are read-only sources; nothing migrates off them

> **Superseded by [ADR 0013](0013-no-channel-ingestion.md) on 2026-08-07.** Every access path this ADR
> depended on required the Initiative to grant credentials or administrator rights, so ingestion was a
> dependency on a third party's cooperation beneath the platform's front page. Feed content is now
> authored on the platform. The reasoning below is retained because the *outward* argument still holds:
> the platform must not compete with the Initiative's own distribution.


The Initiative has years of accumulated work on Telegram (3,000+ messages), Instagram (684 posts, 17.2K followers), YouTube, TikTok and Facebook. None of it moves. Ingestion reads each Channel on a schedule, stores a Feed Item holding the text, a cached media reference, a timestamp and a deep link, and the Channel remains the only copy of record.

## Why this is the constraint and not a phase

A future reader will reasonably ask why the platform does not own its own content, and be tempted to "finish the migration". It is deliberate. The Initiative's audience already lives on those Channels and its reach depends on them; a platform that competes with its own distribution loses. The platform's job is to be the single place where the scattered work is *visible and actionable*, not the place where it is *stored*.

## Consequences

The platform is structurally read-only toward Channels — there is no publish path, and adding one is a new ADR, not a feature. Ingestion runs on a timer and never on request, so a Channel outage degrades freshness rather than availability. Because Feed Items are a cache and not the record, they are safe to delete and rebuild, which makes schema changes to ingestion cheap. Deep links mean every Feed Item hands engagement back to the Channel, which is intended.

The load-bearing risk is platform API terms: Instagram in particular restricts automated reading, so ingestion must run through the official Graph API against the Initiative's own accounts, and each Channel needs a documented, ToS-compliant access path before its ingestion ships.
