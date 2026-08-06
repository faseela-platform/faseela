---
status: accepted
date: 2026-08-06
---

# Universal monorepo: Next.js for web, Expo for native, shared UI package

The Initiative needs a public web presence in month two and app-store presence in month four, with two or three Editors maintaining one body of content. Rather than build a web app now and a separate native app later, we ship one monorepo where Next.js and Expo consume the same `packages/ui`, the same Drizzle schema, and the same Better Auth instance — targeting roughly 80% shared code.

## Considered options

**Separate codebases per platform** was rejected because it doubles the Editor-facing surface and guarantees drift between web and native at exactly the moment the Initiative's staff is smallest.

**React Native Web as the single renderer** (one Expo codebase serving web too) was rejected because the Feed and landing page are public, SEO-relevant, and heavily typographic. Web-first Next.js rendering gives us real server components, proper metadata, and the CSS control that Arabic kinetic typography needs; React Native Web would fight us on all three.

## Consequences

`packages/ui` may only contain components that work under both renderers, which means primitives get built twice at the leaf level and shared at the composition level. Anything relying on DOM-only APIs stays in `apps/web`. This constraint is enforced by the deep-module boundary rules (ADR 0004), not by convention.
