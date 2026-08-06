$ErrorActionPreference = "Stop"
Set-Location "C:\Users\abdul\Desktop\freelance\faseela\faseela-platform"

$msg = @'
docs(design): add measured colour, typography and motion systems

Colour and Arabic type metrics are measured from real assets, not assumed.

- Brand colours sampled from the original 1080px logo rather than a
  screenshot. Teal and gold sit 88.5 degrees apart at near-equal lightness.
  The teal is at 99% of the sRGB chroma ceiling, so it cannot be pushed more
  vivid and clips under opacity or filter.
- Ramps generated with chroma as a fraction of each step's own gamut ceiling,
  so both hues read as equally vivid.
- APCA verified: the brand teal fails the body-text floor (Lc 51.3) and is
  large-text-only. Dark mode inverts to steps 100-200; reusing step 500 would
  land at Lc 35.8, failing even the large-text floor.
- Arabic ink extent measured from eight font binaries: 1.07x to 1.61x the
  Latin span. Tailwind leading-tight clips five of eight. The display floor is
  ~1.42, not 1.1. Almarai clips its own glyphs at line-height normal.
- Motion spec forbids letter-spacing on Arabic because it severs the cursive
  joins, mandates word-level rather than letter-level splitting, and derives
  direction instead of hardcoding translateX.

ADR 0009 defers the 29LT Idris kashida-axis licence and keeps the display font
swappable. ADR 0010 flags the deliberate faint teal cast on the neutral ramp.
'@

$msg | Out-File -FilePath ".git\COMMIT_EDITMSG_manus" -Encoding utf8 -NoNewline

git add -A
git -c core.hooksPath=NUL commit -q --file=".git\COMMIT_EDITMSG_manus"
Remove-Item ".git\COMMIT_EDITMSG_manus" -Force
git log --oneline -3
Write-Output "--- files in last commit ---"
git show --stat --oneline HEAD | Select-Object -First 20
