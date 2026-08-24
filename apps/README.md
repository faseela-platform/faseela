# Apps

Deployable surfaces. Each app composes packages; none of them is imported by anything.

| App      | Target                                                                         |
| -------- | ------------------------------------------------------------------------------ |
| `web`    | Next.js — the public Feed, Tracks, landing page, and the Editor review surface |
| `native` | Expo — iOS and Android                                                         |

Apps import packages through their entry points only, the same rule everything else follows. An app never imports another app.

Logic that both apps need belongs in a package, not copied across. When something in `web` starts looking useful to `native`, that is the signal to extract it — see [../packages/README.md](../packages/README.md) for the shape to extract it into.
