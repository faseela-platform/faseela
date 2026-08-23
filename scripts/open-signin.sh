#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Faseela — "Open sign-in" cutover wizard
#
# The code side of Slice 1 is done and merged: apps/web/lib/email.ts sends real
# mail via Resend the moment RESEND_API_KEY + EMAIL_FROM exist, and /dukhul then
# shows the real sign-in form. This wizard walks the human-only steps that flip
# that switch: a domain, Resend, DNS, and the Vercel env — in the one order that
# avoids spam-foldering every magic link.
#
# It does NOT store secrets and never sends money on your behalf. It guides,
# checks what it can (DNS, the live site), and pauses for you to act.
#
# Run:  bash scripts/open-signin.sh
# ---------------------------------------------------------------------------
set -u

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
rule()  { printf '%s\n' "────────────────────────────────────────────────────────────"; }
pause() { read -r -p "$(printf '\033[1m↵ %s\033[0m' "${1:-Press Enter to continue…}")" _; }
ask()   { read -r -p "$(printf '\033[1m? %s \033[0m' "$1")" REPLY; }

clear 2>/dev/null || true
rule; bold "  فسيلة — open sign-in (Resend cutover)"; rule
cat <<'INTRO'

This flips production sign-in from CLOSED to OPEN. Nothing here touches code —
the code is already deployed and waiting on two env vars. Order matters:
send from an unverified domain and Gmail spam-folders the links, which for a
magic-link product is a locked door. So we verify BEFORE we flip.

You will need, in order:
  1) a temporary domain (~$10/yr; the official faseela.org stays with the owner)
  2) a free Resend account + API key
  3) DNS access at wherever you buy the domain
  4) access to the Vercel project "faseela"

INTRO
pause "Ready? Press Enter."

# ---------------------------------------------------------------------------
rule; bold "STEP 1 · Pick and buy a temporary domain"; rule
cat <<'S1'

Buy a cheap domain you control (Cloudflare, Namecheap, Porkbat, etc.).
Suggestions that read well in Arabic contexts: faseela24.org, faseela-app.com.
NOTE: this spends money and registers a name — the owner should sign off.

S1
ask "Type the domain you registered (e.g. faseela24.org):"
DOMAIN="${REPLY// /}"
if [ -z "$DOMAIN" ]; then red "No domain entered — rerun when you have one."; exit 1; fi
FROM="فسيلة <no-reply@${DOMAIN}>"
green "Sender will be:  ${FROM}"
pause

# ---------------------------------------------------------------------------
rule; bold "STEP 2 · Create a Resend account + API key"; rule
cat <<'S2'

  1. Go to  https://resend.com  → sign up (free: ~3,000 emails/mo).
  2. API Keys → Create API Key → copy it (starts with  re_ ).
     Keep it somewhere safe; you'll paste it into Vercel in step 6,
     NOT into this script.

S2
pause "Done creating the key? Press Enter."

# ---------------------------------------------------------------------------
rule; bold "STEP 3 · Add the domain in Resend + copy its DNS records"; rule
cat <<S3

  1. Resend → Domains → Add Domain → enter:  ${DOMAIN}
  2. Resend shows a set of DNS records — typically:
       • an SPF   TXT   record
       • a  DKIM  record (TXT or CNAME)
       • a return-path / MX record
  3. Add EVERY one of them at your domain's DNS settings, exactly as shown.

S3
pause "Added all the DNS records at your registrar? Press Enter to check them."

# ---------------------------------------------------------------------------
rule; bold "STEP 4 · Check DNS has propagated"; rule
DIG="$(command -v dig || true)"; NSL="$(command -v nslookup || true)"
lookup_txt() { if [ -n "$DIG" ]; then dig +short TXT "$1" 2>/dev/null; elif [ -n "$NSL" ]; then nslookup -type=TXT "$1" 2>/dev/null | grep -i text; fi; }
echo; echo "SPF (root TXT of ${DOMAIN}):"; SPF="$(lookup_txt "$DOMAIN")"
if echo "$SPF" | grep -qi "spf1"; then green "  ✓ found an SPF record"; else yellow "  … no SPF seen yet (DNS can take minutes–48h)"; fi
echo; echo "Resend also verifies DKIM/return-path — confirm those in the Resend UI."
cat <<'S4'

Propagation can lag. Re-run this wizard any time to re-check, or just watch the
Resend Domains page until every record shows a green "Verified".
S4
ask "Does Resend show the domain as VERIFIED (all records green)? (yes/no):"
case "${REPLY,,}" in
  y|yes) green "Great — verified domains send to any address." ;;
  *) yellow "Stop here until it's Verified. Flipping the switch now would spam-fold every link."; echo "Re-run when verified: bash scripts/open-signin.sh"; exit 0 ;;
esac
pause

# ---------------------------------------------------------------------------
rule; bold "STEP 5 · (recommended) send yourself a test email from Resend"; rule
cat <<S5

In Resend → Emails → "Send test", send one to your own inbox from
no-reply@${DOMAIN}. Confirm it arrives in the INBOX, not spam. If it lands in
spam, do not proceed — recheck SPF/DKIM alignment first.
S5
pause "Test email landed in the inbox? Press Enter."

# ---------------------------------------------------------------------------
rule; bold "STEP 6 · Set the env vars on Vercel"; rule
cat <<S6

Set these on the Vercel project "faseela" (Production scope), then they take
effect on the next deploy:

  RESEND_API_KEY = re_…            (your key from step 2)
  EMAIL_FROM     = ${FROM}
  EMAIL_REPLY_TO = (optional, e.g. hello@${DOMAIN})

Two ways:
  • Dashboard: vercel.com → faseela → Settings → Environment Variables.
  • CLI:  pnpm dlx vercel@latest env add RESEND_API_KEY production
          pnpm dlx vercel@latest env add EMAIL_FROM production
          (paste the value when prompted)

Leave BETTER_AUTH_URL as https://faseela.vercel.app (unchanged for now).
S6
pause "Env vars set on Vercel (Production)? Press Enter."

# ---------------------------------------------------------------------------
rule; bold "STEP 7 · Redeploy so the new env is picked up"; rule
cat <<'S7'

Vercel does not re-run the build with new env until you redeploy:
  pnpm dlx vercel@latest deploy --prod --yes --scope abdullahalkheshenengineers-projects
(deploy from a CLEAN git worktree at HEAD — see the earlier deploy notes — so
node_modules doesn't balloon the upload).
S7
pause "Redeploy finished? Press Enter to smoke-test the live site."

# ---------------------------------------------------------------------------
rule; bold "STEP 8 · Smoke-test the live sign-in"; rule
URL="https://faseela.vercel.app/dukhul"
echo "Fetching ${URL} …"
BODY="$(curl -s --max-time 20 "$URL" || true)"
if echo "$BODY" | grep -q "لم يُفتح بعد"; then
  red "  ✗ /dukhul still shows 'not open yet' — the env didn't take."
  echo "    Check: are RESEND_API_KEY and EMAIL_FROM both set (Production) AND did you redeploy?"
  echo "    (Remember turbo.json passthrough — already handled in code, but the vars must be non-empty.)"
elif echo "$BODY" | grep -qiE "البريد الإلكتروني|أرسل رابط الدخول"; then
  green "  ✓ /dukhul shows the real sign-in form. Sign-in is OPEN."
  echo
  bold "Final human check:"
  echo "  1. Open ${URL} → enter YOUR email → 'أرسل رابط الدخول'."
  echo "  2. The Arabic email arrives → click 'الدخول إلى فسيلة'."
  echo "  3. On a track, complete an attest task → visit /lawha → you're on the board."
else
  yellow "  ? Couldn't tell from the HTML. Open ${URL} in a browser to confirm."
fi

echo
rule; green "  Done. To swap to the official faseela.org later:"; rule
cat <<'DONE'
  verify faseela.org in Resend → change EMAIL_FROM to …@faseela.org → redeploy.
  If the site also moves to a faseela.org domain on Vercel, update
  BETTER_AUTH_URL to match. Config only — no code changes.
DONE
