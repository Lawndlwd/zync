#!/bin/sh
set -e

CONFIG_DIR="$HOME/.config/opencode"
PROJECT_CONFIG="/app/opencode.json"

# If user mounted a custom global config, use it directly
if [ -f "/config/opencode.json" ]; then
  echo "Using mounted global config from /config/opencode.json"
  cp /config/opencode.json "$CONFIG_DIR/opencode.json"
else
  # Generate a minimal global config with the MCP server pointing to container paths
  cat > "$CONFIG_DIR/opencode.json" <<JSONEOF
{
  "\$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "allow",
    "*.env": "deny",
    "*.env.example": "allow"
  },
  "mcp": {
    "ai-dashboard": {
      "type": "local",
      "command": ["node", "/app/packages/server/dist/mcp-server/index.js"],
      "environment": {
        "NODE_ENV": "production",
        "DOCUMENTS_PATH": "${DOCUMENTS_PATH:-/app/documents}",
        "MCP_ENABLED_GROUPS": "${MCP_ENABLED_GROUPS:-}"
      },
      "enabled": true
    }
  }
}
JSONEOF
fi

echo "OpenCode config: $CONFIG_DIR/opencode.json"
echo "Project config:  $PROJECT_CONFIG"
echo "Starting opencode serve on 0.0.0.0:4096..."

exec opencode serve \
  --hostname 0.0.0.0 \
  --port 4096 \
  --cors "${CORS_ORIGINS:-http://localhost:3001}" \
  --print-logs \
  --log-level "${OPENCODE_LOG_LEVEL:-INFO}"
