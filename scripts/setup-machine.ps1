# Closes the gaps between this machine and what the repo expects.
# Interactive by design: every step here either installs software or touches an
# account, so a human confirms each one.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-machine.ps1

$ErrorActionPreference = 'Stop'

function Ask($question, $default = 'y') {
    $suffix = if ($default -eq 'y') { '[Y/n]' } else { '[y/N]' }
    $answer = Read-Host "$question $suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $default }
    return $answer -match '^[Yy]'
}

function Step($number, $title) {
    Write-Host ''
    Write-Host "── $number. $title" -ForegroundColor Cyan
}

Write-Host 'Faseela platform — machine setup' -ForegroundColor Green
Write-Host 'Four gaps between this machine and what the repo expects.'

# ── 1. Node 24 LTS ───────────────────────────────────────────────────────────
Step 1 'Node 24 LTS'

$nodeVersion = (node -v 2>$null)
Write-Host "Currently: $nodeVersion. The repo pins Node 24 (see .nvmrc)."
Write-Host 'Node 25 is a Current release, not LTS: it receives no long-term support'
Write-Host 'and native modules routinely lag behind it. Every pnpm command in this'
Write-Host 'repo warns about it until fixed.'

$hasFnm = $null -ne (Get-Command fnm -ErrorAction SilentlyContinue)
if (-not $hasFnm -and (Ask 'Install fnm (a fast Node version manager that reads .nvmrc)?')) {
    winget install --id Schniz.fnm --accept-package-agreements --accept-source-agreements
    Write-Host 'Installed. Add this to your PowerShell profile so fnm switches automatically:' -ForegroundColor Yellow
    Write-Host '  fnm env --use-on-cd | Out-String | Invoke-Expression'
    Write-Host 'Then run:  fnm install 24 ; fnm use 24'
}
elseif ($hasFnm -and (Ask 'fnm is present. Install and select Node 24 now?')) {
    fnm install 24
    fnm use 24
    node -v
}

# ── 2. GitHub CLI ────────────────────────────────────────────────────────────
Step 2 'GitHub CLI'

if ($null -ne (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host 'gh is already available.' -ForegroundColor Green
}
elseif (Ask 'Install the GitHub CLI? (needed for the private repo and GitHub-based tickets)') {
    winget install --id GitHub.cli --accept-package-agreements --accept-source-agreements
    Write-Host 'Installed. Open a new terminal, then: gh auth login' -ForegroundColor Yellow
}

# ── 3. The private repository ────────────────────────────────────────────────
Step 3 'Private repository'

Write-Host 'The repo is local-only right now. Creating it under your account keeps'
Write-Host 'ownership with you until the Initiative has its own GitHub organisation,'
Write-Host 'at which point transfer is a single operation.'

if ((Get-Command gh -ErrorAction SilentlyContinue) -and (Ask 'Create abdullahalkheshen/faseela-platform as private and push?' 'n')) {
    gh repo create abdullahalkheshen/faseela-platform --private --source . --remote origin
    Write-Host 'Created. Review the first commit, then push it yourself:' -ForegroundColor Yellow
    Write-Host '  git push -u origin main'
    Write-Host '(The guardrails hook blocks agents from pushing; pushing stays yours.)'
}

# ── 4. Playwright ────────────────────────────────────────────────────────────
Step 4 'Playwright browsers'

Write-Host 'Visual verification renders the app in a real browser in both text'
Write-Host 'directions — the only way Arabic joins and descender clipping show up.'

if (Ask 'Install Playwright browsers? (~400 MB)' 'n') {
    pnpm dlx playwright install chromium webkit
}

Write-Host ''
Write-Host 'Done. Verify with:  node -v  &&  gh --version  &&  pnpm check' -ForegroundColor Green
