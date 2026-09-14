#!/bin/bash
# Runs inside the cmux workspace opened by handle-url.sh: makes sure the LEARN session is valid
# (running the learn-auth alias if not), then starts Claude Code or Codex on the to-do's assignment.
set -euo pipefail

agent="${1:?usage: run-agent.sh <claude|codex> <todo-id>}"
todo="${2:?usage: run-agent.sh <claude|codex> <todo-id>}"
[[ "$agent" =~ ^(claude|codex)$ && "$todo" =~ ^[0-9]{1,9}$ ]] || { echo "Invalid arguments." >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/bin:$PATH"

learn_session_ok() { brightspace-mcp doctor --profile waterloo >/dev/null 2>&1; }

echo "Checking LEARN session…"
if ! learn_session_ok; then
  echo "LEARN session expired — opening login (learn-auth)…"
  zsh -ic learn-auth
  if ! learn_session_ok; then
    echo "Still not logged in to LEARN. Run learn-auth and try the button again." >&2
    exit 1
  fi
fi
echo "LEARN session OK."

prompt="$(sed "s/{{TODO_ID}}/$todo/g" "$HERE/prompt.md")"
no_submit="Never submit, upload, or post anything to LEARN/Brightspace or anywhere else on the user's behalf. The user reviews and submits all work themselves."

case "$agent" in
  claude)
    # --no-chrome: no browser, so there is no way to click Submit on LEARN.
    # Pre-approved tools are read-only (brightspace-mcp's writes gate is off); create_todo still asks.
    exec claude --no-chrome \
      --allowedTools mcp__life-tracker__get_todo mcp__life-tracker__list_todos mcp__life-tracker__list_categories mcp__brightspace \
      --permission-mode acceptEdits \
      --append-system-prompt "$no_submit" \
      "$prompt"
    ;;
  codex)
    # Edits and commands run inside the workspace-write sandbox (cwd); anything else asks first.
    exec codex --sandbox workspace-write --ask-for-approval on-request "$prompt"
    ;;
esac
