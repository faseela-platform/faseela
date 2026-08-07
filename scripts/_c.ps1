Set-Location "C:\Users\abdul\Desktop\freelance\faseela\faseela-platform"
Remove-Item "*.log" -Force -ErrorAction SilentlyContinue
git add -A
$msg = @"
feat(db): schema, point ledger and leaderboard on Neon

Drizzle schema for the v1 product (G3A): Tracks, Tasks, Submissions,
Seasons and Points, plus Better Auth's identity tables in the same
database.

Points are an append-only ledger, not a running total (ADR 0015):
- value frozen at award time, so editing a Task never rewrites history
- Season resolved once and stored, so correcting Season dates never
  moves Points between Seasons
- idempotency is a unique index on submission_id, not a read-then-write
  check, so two concurrent accepts cannot both mint

Three systems share one database with disjoint table sets and one
migration authority each (ADR 0014). db:push is banned outright.

Leaderboard separates rank from order: rank ignores the tie-break so
equal Points share a rank, ordering breaks ties on who got there first
for stability. Putting the tie-break inside the RANK window silently
makes it a ROW_NUMBER - caught by test.

Tests run against PGlite (real Postgres in WASM) applying the generated
migration, so a dropped constraint fails in CI rather than production.
"@
git commit -q -m $msg
git log --oneline -1
