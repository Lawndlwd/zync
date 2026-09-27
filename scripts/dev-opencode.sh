#!/bin/sh
# Run the opencode server locally exactly like the Docker image: one config file, seeded once from
# opencode/opencode.json, with zync's MCP server + skills merged in. Your personal
# ~/.config/opencode is not read or touched (XDG_CONFIG_HOME points inside data/).
# Usage: pnpm dev:opencode   (after `pnpm build` so packages/jobs/dist exists)
set -e
cd "$(dirname "$0")/.."
: "${WORKSPACES_ROOT:=$PWD/data/workspaces}"
export WORKSPACES_ROOT

# Provider keys and other values used as {env:…} in the config.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

export XDG_CONFIG_HOME="$PWD/data/opencode/config"
# The server runs inside this repo (data/workspaces): without this it would walk up and load the
# repo's own coding rules (AGENTS.md, CLAUDE.md, .opencode/) into the product's AI. Docker has no
# such parent folder.
export OPENCODE_DISABLE_PROJECT_CONFIG=1
config="$XDG_CONFIG_HOME/opencode/opencode.json"
mkdir -p "$WORKSPACES_ROOT" "$(dirname "$config")"
# First run only: afterwards the file belongs to you (Settings → AI server in the app).
[ -f "$config" ] || cp opencode/opencode.json "$config"

run="$PWD/opencode/run.sh"
cd "$WORKSPACES_ROOT"
# Supervised so Settings → Restart AI server can restart it (see opencode/run.sh).
exec "$run" "$config" --hostname 127.0.0.1 --port 4096
