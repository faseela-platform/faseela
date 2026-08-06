# Packages

Every package here is a **deep module**: a lot of behaviour behind a small interface. Copy this shape.

```
packages/
  <name>/
    index.ts      ← an entry point (public). Import this from outside.
    client.ts     ← another entry point. A package may expose several.
    lib/          ← implementation. Private. These files import each other freely.
    tests/        ← co-located tests and fixtures. Private, because it is a subfolder.
```

Public versus private is decided by **depth**, not by naming: a package's root files are its entry points, and *anything* in *any* subfolder is private. A new subfolder therefore never needs a config change. `lib/` and `tests/` are convention, not rule.

## The four rules

`pnpm lint:boundaries` enforces these, all at error severity, and they have been proved to fail on a real violation rather than merely configured.

**Entry-point boundary** — code outside a package imports only that package's root files. Reaching into `packages/ui/lib/button-internals` from an app is an error.

**Intra-package freedom** — a package's own files import each other however they like. The boundary is around the package, not inside it.

**Tests through the entry points** — files under `<pkg>/tests/` may import any package's entry points and their own fixtures, but no package's internals, including their own. Integration tests across packages are welcome; deep imports to make a test easier are not.

**No cycles** — a dependency cycle fails the build.

## Add an entry point by adding a root file

Barrel files that re-export a whole subtree defeat the purpose: they make the interface as wide as the implementation, so nothing is actually hidden. Expose several small entry points instead — `index.ts`, `client.ts`, `server.ts` — each naming what it is for.

Packages are flat. One tier of folders under `packages/`; a package's internals may nest as deep as you like, but a package never contains another package.

## Layering is separate

Which packages may depend on which is a different question from what is public, and it lives as a commented stub at the bottom of `.dependency-cruiser.cjs`. Fill it in once the graph has a shape worth constraining.
