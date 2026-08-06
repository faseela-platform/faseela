---
status: accepted
date: 2026-08-06
---

# Packages are deep modules, enforced by dependency-cruiser

Every package under `packages/` exposes its behaviour through its root files only; anything in a subfolder is private. Four error-level dependency-cruiser rules enforce this: outside code may import only a package's root entry points, a package's own files import each other freely, tests reach other packages only through entry points, and no dependency cycles exist.

This is recorded because the rule is invisible in the code and a reasonable contributor will trip over it. It also has a specific job here beyond general hygiene: two agents write in this repo, and agents reach for a plausible import path far more readily than a human reading a folder. A boundary the CI enforces is a boundary an agent discovers on its first violation rather than in review.

## Consequences

Barrel files that re-export a whole subtree are discouraged; a package exposes several small root entry points instead. Adding a public surface is adding a root file, never editing a barrel. `pnpm lint:boundaries` runs inside the umbrella check, and the rules have been proved to bite by introducing a deep import and observing CI fail.
