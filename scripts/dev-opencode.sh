#!/bin/sh
# Run opencode web locally with zync's MCP server + skills, without touching ~/.config/opencode.
# Usage: pnpm dev:opencode   (after `pnpm build` so packages/jobs/dist exists)
set -e
cd "$(dirname "$0")/.."
: "${WORKSPACES_ROOT:=$PWD/data/workspaces}"
export WORKSPACES_ROOT
mkdir -p "$WORKSPACES_ROOT" data/.opencode-dev
node opencode/configure.mjs data/.opencode-dev/opencode.json
export OPENCODE_CONFIG="$PWD/data/.opencode-dev/opencode.json"
cd "$WORKSPACES_ROOT"
exec opencode web --hostname 127.0.0.1 --port 4096
