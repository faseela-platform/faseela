# Emil skills — provenance and drift record

`skills-lock.json` tracks only Matt Pocock's skills. The Emil Kowalski set below was hand-copied
from **two upstreams** and tracked by nothing, so drift was invisible. This file is the lock for
that set: where each skill came from, the hash it had when last reconciled, and the policy
conflicts we decided *not* to merge. Re-run the check at the bottom before any bulk refresh.

## Upstreams

| Upstream | What it provides | Access | Last reconciled against |
| --- | --- | --- | --- |
| `github.com/emilkowalski/skills` (MIT) | 12 skills: `animate`, `animate-expo`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `pick-ui-library`, `prototype`, `review-animations`, `write-swift` | public | commit `d23d7f8` (2026-08-21) |
| aiforui.dev course installer (`npx @aiforui/install --token=…`) | 20 course skills as of installer 0.1.4: `prototype`, `design-foundations`, `typography`, `color`, `surfaces`, `component-design`, `forms-and-inputs`, `marketing-pages`, `animations`, `ui-polish`, `performance`, `touch-and-accessibility`, `ui-review`, `build-a-tool`, `get-creative`, `ask-emil`, `design-vocabulary`, `engineering-vocabulary`, `writing-skills`, `ask-lapse` | owner's personal token — **never paste it in chat, notes, or this file** | installer 0.1.4, run 2026-08-28 (globally, into `~/.claude/skills`) |

## Course skills — state at 2026-08-28 (installer 0.1.4)

Diffed the fresh global install against the project copy, file by file:

- **Identical (13):** `design-foundations`, `typography`, `color`, `surfaces`, `component-design`,
  `forms-and-inputs`, `marketing-pages`, `animations`, `ui-polish`, `performance`,
  `touch-and-accessibility`, `ui-review`, `design-vocabulary`, `engineering-vocabulary`,
  `writing-skills`. The 2026-08-06 snapshot was current; nothing to merge.
- **New upstream (4):** `ask-emil` (router over the design skills — **adopted**), `ask-lapse`
  (Lapse animation inspector: slow-mo, takes, frame scrubbing — **adopted**, for Slice 9 T4/T5
  motion verification), `build-a-tool` and `get-creative` (user-invoked creative-process workflows,
  `disable-model-invocation: true` — **not adopted**; available globally if wanted).
- **Retired upstream, retained here (6):** `animation-accessibility`, `animation-performance`,
  `css-animations`, `motion-react`, `motion-brief`, `prototype-animations-dev`. They carry rules we
  build against (`css-animations` is the ADR 0011 scroll authority) — keep, and know they will not
  receive upstream updates.
- **Name collision — `prototype`.** Emil's course ships a `prototype` skill (UI variations behind a
  picker, `CONTROLS.md`/`PICKER.md`); the project's `prototype` is **Matt Pocock's** (throwaway
  logic/UI prototypes, `LOGIC.md`/`UI.md`, tracked in `skills-lock.json`). The 0.1.4 installer
  wrote Emil's version *through the symlink* `~/.claude/skills/prototype → ~/.agents/skills/prototype`,
  overwriting Matt's global `SKILL.md`. Repaired 2026-08-28: Matt's file restored from the project
  copy (verified by content — its frontmatter reads "Build a throwaway prototype to answer a design
  question"; note `skills-lock.json`'s `computedHash` is *not* a plain sha256 of `SKILL.md`, so it
  cannot be used for this check), Emil's version given a real `~/.claude/skills/prototype` directory.
  **Re-running the installer will clobber it again** — afterwards, confirm
  `~/.agents/skills/prototype/SKILL.md` still opens with Matt's description and carries
  `LOGIC.md`/`UI.md`, not `CONTROLS.md`/`PICKER.md`. In this repo, `faseela-platform:prototype` = Matt's.
- **Shadowing.** The global install now mirrors the project's course skills byte-for-byte, so the
  double listing (`typography` and `faseela-platform:typography`) is harmless; the scoped one wins
  inside the repo.

## GitHub-family skills — state at 2026-08-28

Hashes are the first 16 hex of `sha256(SKILL.md)`.

| Skill | Local | Upstream `d23d7f8` | Status |
| --- | --- | --- | --- |
| `animate` | `8f19558140` | `58306092db` | **diverged — local rewrite**, keep (local adds SVG/Framer refs, stagger/cohesion rules) |
| `animate-expo` | `8893293d36` | `8893293d36` | **adopted 2026-08-28**, identical — the only skill covering `apps/native` |
| `animation-vocabulary` | `e25536185c` | `de5828e110` | diverged — local rewrite, keep |
| `apple-design` | `da9581408c` | `da9581408c` | **adopted 2026-08-28**, identical |
| `emil-design-engineering` (upstream: `emil-design-eng`) | `4500a7fe83` | `defffff8be` | diverged — local rewrite with 8 reference files, keep |
| `find-animation-opportunities` | `6591a928b0` | `38edd3c52f` | diverged — local rewrite, keep |
| `improve-animations` | `92373cf3a8` | `f7bcd002f2` | diverged — local rewrite, keep |
| `pick-ui-library` | `97f1888dd5` | `26c7dc79e9` | diverged — upstream purged Radix (2026-07-21); see policy 1 |
| `prototype` | `ad67a04d7f` | `848a67552f` | diverged — local is Matt's `prototype`, a different skill sharing the name; not an Emil drift |
| `review-animations` | `c04fa90301` | `9b9766965a` | diverged — local rewrite, keep |
| `ask-sonner`, `write-swift` | — | present | deliberately not adopted (no Sonner, no Swift here) |

"Diverged — local rewrite" means the local file is an independent rewrite carrying content the
upstream lacks, not a stale copy. **Do not bulk-overwrite**; merge upstream deltas by hand when a
specific rule is wanted.

## Policy conflicts — decided, not merged

1. **Radix → Base UI.** Upstream removed every Radix reference. Our `animate` still lists
   `--radix-popover-content-transform-origin`. Decision: adopt Base UI's `--transform-origin`
   naming *when a popover is actually built*; the app has none today. No edit now.
2. **Easing tokens.** Upstream `animate` moved `--ease-out-expo` to `(0.23, 1, 0.32, 1)`; ours is
   `(0.19, 1, 0.22, 1)` and is what `docs/design/motion.md` documents. Taste delta — **keep ours**.
3. **Spring bounce.** Upstream examples drift to `bounce: 0.15–0.2` for playful UI. Faseela is an
   institutional, editorial product — **default `bounce: 0`** stays.
4. **Reduced motion — OPEN, owner decision.** Three local files
   (`emil-design-engineering/animations.md`, `animations/SKILL.md`, `animations/techniques.md`)
   say "disable all, no exceptions for opacity"; `animation-accessibility` and upstream `animate`
   say "gentler, not zero — keep opacity/colour, remove movement". The repo's own **ADR 0011 and
   `packages/tokens/theme.css`** side with the first ("reduced means reduced, including opacity
   fades"; the load-bearing half is *resolve scroll-driven content to its final state*). Changing
   the skill text without changing the ADR would be silent drift, so this is left as a question
   for Slice 9 T4: keep ADR 0011's all-off rule, or narrow it to "movement off, state-change
   fades kept, decorative off". Until decided, the ADR wins.
5. **Motion-for-React.** Upstream `animate`/`pick-ui-library` lean on Motion. ADR 0011 keeps the
   landing CSS-scroll-driven with zero JS; Motion is admissible for gesture/product UI only
   (`motion-react`, `apple-design`). `css-animations` remains the scroll authority.

## Cross-references fixed

`faseela-arabic-rtl` referenced `interface-animations` and `color-systems`, neither of which
exists; now `animations` and `color` (2026-08-28). `faseela-arabic-rtl` wins over every Emil skill
on conflict — that rule is unchanged.

## Re-checking for drift

```sh
# from faseela-platform/
git clone --depth 1 https://github.com/emilkowalski/skills /tmp/emil-remote
for s in animate animate-expo animation-vocabulary apple-design find-animation-opportunities improve-animations pick-ui-library review-animations; do
  printf "%-30s local %s  remote %s\n" "$s" "$(sha256sum .claude/skills/$s/SKILL.md | cut -c1-10)" "$(sha256sum /tmp/emil-remote/skills/$s/SKILL.md | cut -c1-10)"
done
# emil-design-engineering ↔ remote emil-design-eng (renamed locally)
```

For the course skills: owner runs `npx @aiforui/install --token=<theirs>` into a **scratch
directory outside the repo**, then diff per skill the same way. Merge only rules that are
genuinely newer; the course's core rules have been stable across 0.1.x.
