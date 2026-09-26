#!/bin/sh
set -e

role="${1:-api}"

require_auth() {
  # opencode can run any shell command on every workspace: never serve it without auth.
  if [ -z "$BASIC_AUTH_USERS" ] && [ "$ALLOW_NO_AUTH" != "1" ]; then
    echo "ERROR: BASIC_AUTH_USERS is empty. Set it (see .env.example) or ALLOW_NO_AUTH=1 for local use only." >&2
    exit 1
  fi
}

case "$role" in
  api)
    require_auth
    exec node /app/packages/api/dist/index.js
    ;;
  scheduler)
    exec node /app/packages/jobs/dist/scheduler.js
    ;;
  opencode)
    require_auth
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
