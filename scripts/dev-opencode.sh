#!/bin/sh
# Run opencode web locally exactly like the Docker image: one config file, seeded once from
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
config="$XDG_CONFIG_HOME/opencode/opencode.json"
mkdir -p "$WORKSPACES_ROOT" "$(dirname "$config")"
# First run only: afterwards the file belongs to you (Settings → AI server in the app).
[ -f "$config" ] || cp opencode/opencode.json "$config"
node opencode/configure.mjs "$config"

cd "$WORKSPACES_ROOT"
exec opencode web --hostname 127.0.0.1 --port 4096
