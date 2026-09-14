-- URL handler for lifetracker-agent:// links; install.sh replaces __HANDLER__ with handle-url.sh's path.
on open location theURL
	do shell script "/bin/bash " & quoted form of "__HANDLER__" & " " & quoted form of theURL & " >> \"$HOME/Library/Logs/LifeTrackerAgent.log\" 2>&1 &"
end open location

on run
	display notification "Click Claude or Codex on a to-do in Life Tracker to start an agent." with title "Life Tracker Agent"
end run
