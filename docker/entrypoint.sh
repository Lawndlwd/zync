#!/bin/sh
set -e

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
    ZYNC_MCP_PATH=/app/packages/jobs/dist/mcp.js ZYNC_SKILLS_DIR=/app/opencode/skills \
      node /app/opencode/configure.mjs "$config"
    cd "${WORKSPACES_ROOT:-/workspace}"
    exec opencode web --hostname 0.0.0.0 --port 4096 --print-logs --log-level "${OPENCODE_LOG_LEVEL:-INFO}"
    ;;
  *)
    exec "$@"
    ;;
esac
