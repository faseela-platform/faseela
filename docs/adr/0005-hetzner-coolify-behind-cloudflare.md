---
status: accepted
date: 2026-08-06
---

# Hetzner + Coolify for compute, Cloudflare at the edge

Compute runs on two Hetzner servers — a CX23 hosting Coolify as the control plane, a CX33 as the deployment target — with Cloudflare providing DNS, CDN, WAF and R2 object storage in front. Neon holds the database. Roughly €14/month.

## Why not Vercel

Cost was not the deciding factor. Vercel's preview deployments are serverless-shaped: they cannot start a long-running worker, so a preview of a change to Ingestion cannot actually run Ingestion. Because the Feed depends on scheduled ingestion workers for Telegram, Instagram and YouTube alongside Payload, previews that exclude the workers would exclude the part most likely to break. Coolify previews are full Docker deployments, and paired with a Neon database branch they run the whole system per pull request.

Cloudflare Pages/Workers was rejected for the same reason in a different shape — Workers' runtime constraints would force the ingestion workers somewhere else anyway, splitting the deployment story.

## Consequences

We accept a self-hosting tax: roughly 3–5 hours to wire test-gating and deployment properly, and 10–20 hours a year of upkeep — patching, Coolify upgrades, certificate and disk monitoring. Running Coolify on its own server rather than beside production is what keeps a control-plane upgrade from being a production incident.

One trap is recorded so nobody rediscovers it: Next.js ISR caching to local disk breaks across multiple app instances and needs a shared `cacheHandler`. At one instance this is a non-issue, and the Initiative's traffic will not require horizontal scaling for years — but the moment a second instance appears, this becomes the first thing to fix.

Note that Hetzner raised prices on 15 June 2026, so historical pricing references are stale.
