#!/bin/sh
# Run the opencode server and restart it on request (Settings → Restart AI server).
#
#   opencode/run.sh <config-file> [opencode server args…]
#
# It runs `opencode serve`: the same server and web UI as `opencode web`, without opening a browser
# tab on every (re)start — the app embeds the chat. OPENCODE_OPEN_BROWSER=1 uses `opencode web` instead.
#
# opencode reads providers and models once per process, so a config change needs a real restart.
# The app asks for one by writing a new value into <config dir>/.restart (a folder the app and
# opencode share); this loop notices within a second, stops opencode, re-applies zync's pieces to the
# config (configure.mjs) and starts it again. It also brings opencode back if it crashes.
set -u

config="$1"
shift
here="$(cd "$(dirname "$0")" && pwd)"
trigger="$(dirname "$config")/.restart"
last="$(cat "$trigger" 2>/dev/null || true)"
pid=""

stop() {
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null
  exit 0
}
trap stop INT TERM

while :; do
  node "$here/configure.mjs" "$config"
  if [ "${OPENCODE_OPEN_BROWSER:-0}" = 1 ]; then opencode web "$@" & else opencode serve "$@" & fi
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    sleep 1
    now="$(cat "$trigger" 2>/dev/null || true)"
    if [ "$now" != "$last" ]; then
      last="$now"
      echo "[zync] restarting opencode (requested from Settings)"
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      break
    fi
  done
  wait "$pid" 2>/dev/null
  pid=""
  sleep 1
done
