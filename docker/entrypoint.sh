#!/bin/sh
set -e

# Mounted folders can be root-owned (Docker creates a missing host folder as root), and then the app
# can't create workspaces ("EACCES: permission denied, mkdir '/workspace/…'"). Started as root, hand
# them to `node` — only entries that aren't already its own, so restarts stay fast — then re-run this
# script as `node`.
if [ "$(id -u)" = 0 ]; then
  for dir in "${WORKSPACES_ROOT:-/workspace}" /opencode-config /home/node/.config/opencode /home/node/.local/share/opencode; do
    if [ -d "$dir" ]; then
      find "$dir" -xdev \! -user node -exec chown node:node {} + 2>/dev/null || true
    fi
  done
  exec gosu node "$0" "$@"
fi

role="${1:-api}"

require_ack() {
  # The app (and the AI chat it serves) can run shell commands on every workspace and has no login.
  if [ "$ALLOW_NO_AUTH" != "1" ]; then
    echo "ERROR: zync has no login: anyone who can reach it can use your files and the AI." >&2
    echo "       Put it behind access control (VPN, IP allow-list…), then set ALLOW_NO_AUTH=1." >&2
    exit 1
  fi
}

case "$role" in
  api)
    require_ack
    exec node /app/packages/api/dist/index.js
    ;;
  scheduler)
    exec node /app/packages/jobs/dist/scheduler.js
    ;;
  opencode)
    config="$HOME/.config/opencode/opencode.json"
    # First start of a fresh opencode-config volume: seed it from the repo's opencode/opencode.json.
    # Afterwards the volume copy is the source of truth (edited from Settings → AI server).
    if [ ! -f "$config" ]; then
      mkdir -p "$(dirname "$config")"
      cp /app/opencode/opencode.json "$config"
    fi
    export ZYNC_MCP_PATH=/app/packages/jobs/dist/mcp.js ZYNC_SKILLS_DIR=/app/opencode/skills
    cd "${WORKSPACES_ROOT:-/workspace}"
    # Supervised so Settings → Restart AI server can restart it (see opencode/run.sh).
    exec /app/opencode/run.sh "$config" --hostname 0.0.0.0 --port 4096 --print-logs \
      --log-level "${OPENCODE_LOG_LEVEL:-INFO}"
    ;;
  *)
    exec "$@"
    ;;
esac
