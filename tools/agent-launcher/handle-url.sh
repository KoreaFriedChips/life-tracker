#!/bin/bash
# Handles lifetracker-agent://run?agent=<claude|codex>&todo=<id> (opened by LifeTrackerAgent.app)
# by starting run-agent.sh in a new cmux workspace. The URL can come from any web page, so it is
# validated strictly and only the parsed agent name and numeric id are ever used.
set -euo pipefail

CMUX=/Applications/cmux.app/Contents/Resources/bin/cmux
WORK_ROOT="$HOME/Desktop/UWaterloo"
HERE="$(cd "$(dirname "$0")" && pwd)"
URL="${1:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

pattern='^lifetracker-agent://run\?agent=(claude|codex)&todo=([0-9]{1,9})$'
if [[ ! "$URL" =~ $pattern ]]; then
  log "rejected URL: ${URL:0:200}"
  exit 1
fi
agent="${BASH_REMATCH[1]}"
todo="${BASH_REMATCH[2]}"

if ! "$CMUX" ping >/dev/null 2>&1; then
  open -a cmux
  for _ in $(seq 1 20); do
    "$CMUX" ping >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

label="Claude"
[[ "$agent" == codex ]] && label="Codex"

mkdir -p "$WORK_ROOT"
log "starting $agent for to-do $todo"
"$CMUX" new-workspace \
  --name "$label · to-do $todo" \
  --cwd "$WORK_ROOT" \
  --command "'$HERE/run-agent.sh' $agent $todo"
open -a cmux
