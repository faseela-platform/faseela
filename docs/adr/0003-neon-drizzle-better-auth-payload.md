---
status: accepted
date: 2026-08-06
---

# One Postgres: Neon + Drizzle, with Better Auth and Payload sharing it

Neon Postgres accessed through Drizzle is the single datastore. Better Auth handles authentication for both Next.js and Expo against that same database, and Payload 3 runs inside the Next.js app as the Editor-facing admin, also on that same database. One connection string, one migration history, one source of truth.

## Considered options

**Clerk** was the serious alternative for auth. It was rejected because it puts Member identity in someone else's database, which makes Points, Submissions and Leaderboards join across a network boundary — and because Better Auth absorbed Auth.js in September 2025, making it the direction the ecosystem is moving rather than a bet against it. Better Auth being a library rather than a service also means no per-Member pricing as the Initiative scales from its staff of ~50 to a Lebanese and then Arab audience.

**A separate hosted CMS** (Sanity, Directus) was rejected for the same reason: Products, Tracks and Announcements are joined to Tasks, Submissions and Points constantly, and splitting them across two datastores turns every Feed query into an application-level join.

## Consequences

Payload owns its own tables in the shared database and manages them with its own migrations, so two migration systems coexist in one Postgres. Their boundary is a hard rule: Payload owns editorial tables, Drizzle owns Member, Point, Season and Submission tables, and neither writes to the other's. Reads across the boundary are fine and expected.

Neon's branching gives each preview deployment its own database branch, which is what makes the Coolify preview environments in ADR 0005 genuinely useful rather than decorative.
