#!/bin/bash
# Builds ~/Applications/LifeTrackerAgent.app, which handles lifetracker-agent:// links from the
# Life Tracker to-do buttons. Safe to re-run (e.g. after moving the repo).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Applications/LifeTrackerAgent.app"
PLIST="$APP/Contents/Info.plist"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

chmod +x "$HERE/handle-url.sh" "$HERE/run-agent.sh"
mkdir -p "$HOME/Applications"
rm -rf "$APP"

script="$(mktemp -t lifetracker-agent).applescript"
sed "s|__HANDLER__|$HERE/handle-url.sh|" "$HERE/LifeTrackerAgent.applescript" > "$script"
osacompile -o "$APP" "$script"
rm -f "$script"

# osacompile may or may not write a bundle id, so set it either way.
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string dev.life-tracker.agent-launcher" "$PLIST" 2>/dev/null ||
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier dev.life-tracker.agent-launcher" "$PLIST"
/usr/libexec/PlistBuddy \
  -c "Add :LSUIElement bool true" \
  -c "Add :CFBundleURLTypes array" \
  -c "Add :CFBundleURLTypes:0 dict" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLName string Life Tracker Agent" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string lifetracker-agent" \
  "$PLIST"

codesign --force --deep -s - "$APP"
"$LSREGISTER" -f "$APP"

echo "Installed $APP"
echo "Test: open 'lifetracker-agent://run?agent=claude&todo=<id>'"
echo "Logs: ~/Library/Logs/LifeTrackerAgent.log"
