---
status: accepted
date: 2026-08-06
---

# RTL-native from the first commit, Arabic-only in the MVP

The MVP ships Arabic only, yet every layout, component and animation is written direction-aware from commit one, with all copy behind an i18n layer. The Initiative's own growth plan is Lebanese, then Arab, then global with languages enabled — so the second language is a certainty, and retrofitting direction-awareness is far more expensive than starting with it.

The distinction matters because it is easy to misread: Arabic-only is a *content* decision, RTL-native is an *architecture* decision, and they are not the same. Nothing hardcodes `left`, `right`, `translateX` in a physical sense, or Latin-metric assumptions about line height and letter-spacing.

## Consequences

Logical CSS properties (`margin-inline-start`, `inset-inline-end`) are the default and physical properties are the exception that needs justification. Animation offsets are direction-aware, since an entrance sliding "from the start edge" reverses meaning between scripts.

The load-bearing gap: none of the 63 installed craft skills covers Arabic or RTL. The typography set assumes Latin metrics and the animation set assumes `translateX` means one thing. This repo therefore owns a project-specific skill, `.claude/skills/faseela-arabic-rtl/`, which is the authority wherever it disagrees with the imported skills — direction-aware transforms, kashida/tatweel stretching, bidi-safe layout, Arabic type scale and leading, and Arabic font subsetting.
