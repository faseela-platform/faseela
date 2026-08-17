# CLAUDE.md — Faseela platform

Faseela (فسيلة) is an Arabic-first, RTL-native cross-platform app (Next.js web + Expo native) for a
cultural initiative: Tracks (مسارات) → Tasks → Points (append-only ledger) → season Leaderboard, plus a
hand-built aggregating landing page and a WhatsApp-ordering catalogue. Built originally in one Manus
session; development now continues here in Claude Code.

## Read these first

- `AGENTS.md`, `CONTEXT.md`, `docs/` (ADRs) — the repo's own canonical docs and decisions.
- `../_manus_export/PROJECT_HISTORY.md` — how this got built, the 24 founding decisions, current state,
  next actions, and the expensive-to-rediscover traps. Its `notes/` folder is Manus's full project journal.
- `../_manus_export/SECURITY_ROTATE.md` — ⚠️ live secrets to rotate (GitHub PAT, Vercel token, Neon
  password, Payload/Better-Auth secrets). Do this before sharing anything.

## Stack / ground rules (see PROJECT_HISTORY.md for the why)

- Turborepo + pnpm. `apps/web` (Next 15 + Payload 3.87 + Better Auth), `packages/db` (deep module),
  `packages/tokens`. Neon PostgreSQL 18.4 — `public` (our 9 tables) + `payload` (13) schema-isolated.
- `apps/web` is **ESM** (`"type":"module"`) — required or the Payload CLI throws `ERR_REQUIRE_ASYNC_MODULE`.
- Node pinned `>=24 <25` — use fnm's Node 24 (system default may be 25.x; harmless warnings).
- **Invariants that must not break:** points are copied from `task.points` at award time (editing a Task
  never rewrites past Leaderboards); anti-double-mint via DB unique indexes, not app checks; erasure is
  RESTRICT + anonymise, never hard-delete; Leaderboard is season-scoped; column is `mode` not `completion_mode`.
- **Motion is CSS scroll-driven only (ADR 0011)** — the profile mentions framer-motion but the site is
  100% CSS scroll-timeline; don't switch without an explicit decision.

## Current state (2026-08-10)

Web app is feature-complete for the read-only launch: data layer, schema/migrations (verify:db green
against live Neon), Better Auth, Payload (schema-isolated), Track pages on real seeded data, erasure,
admin gate, sign-in page (`/dukhul` — shows "registration not open" while email is unconfigured, by
design), attest mutation (`packages/db/lib/attest.ts` + 12 tests), task-completion UI (`AttestButton`),
Leaderboard (`/lawha`), journey verifier 26/26. Repo: private `faseela-platform/faseela`, main.
Vercel project `faseela` exists and is linked (`.vercel/project.json`).

**Not done:** the actual Vercel deploy, a JSON API for mobile (`/api/v1/*`), and the whole Expo app
(`apps/native` — packages/db uses node-postgres so mobile must consume HTTP, never the DB directly).

**Known blocker (accepted for now — read-only launch):** production sign-in throws until a domain +
email provider (Resend) is wired — magic links currently log to console (ADR 0018). `emailIsDeliverable`
in `apps/web/lib/email.ts` flips the `/dukhul` form on the day a transport is configured.

## Ask before

Registering domains/accounts, editing shell profiles, spending money, or installing the Vercel/GitHub
integrations — the Manus notes flag several of these as "ask Abdullah first."
