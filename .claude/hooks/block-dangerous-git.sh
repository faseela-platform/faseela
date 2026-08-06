#!/usr/bin/env bash
# PreToolUse guard: refuse destructive git commands so a human runs them deliberately.
# See docs/adr/0008-two-agent-operating-model.md — with two agents committing, these
# are the commands that lose work rather than merely waste time.
#
# Reads a Claude Code PreToolUse payload on stdin; exit 2 blocks the call.

set -uo pipefail

payload=$(cat)

# Pull the command out of the tool input without requiring jq.
command=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)

[ -z "$command" ] && exit 0

deny() {
  printf 'Blocked: %s\n\n%s\n' "$1" "Run it yourself if you intend it." >&2
  exit 2
}

case "$command" in
  *git*push*--force*|*git*push*-f*|*git*push*--delete*)
    deny "force or delete push" ;;
  *git*push*)
    deny "git push — pushing is the human's call" ;;
  *git*reset*--hard*)
    deny "git reset --hard discards uncommitted work" ;;
  *git*clean*-f*|*git*clean*-d*|*git*clean*-x*)
    deny "git clean removes untracked files irrecoverably" ;;
  *git*checkout*--*|*git*restore*)
    deny "discarding working-tree changes" ;;
  *git*branch*-D*|*git*branch*--delete*--force*)
    deny "force branch delete" ;;
  *git*rebase*)
    deny "rebase rewrites history the other agent may hold" ;;
  *git*filter-branch*|*git*filter-repo*)
    deny "history rewrite" ;;
  *git*update-ref*-d*|*git*reflog*expire*)
    deny "reflog or ref deletion removes the recovery path" ;;
  *git*commit*--amend*)
    deny "amend rewrites a commit that may already be shared" ;;
esac

exit 0
