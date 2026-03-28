#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${ZYNC_DIR:-$HOME/.zync}"
RAW_BASE="https://raw.githubusercontent.com/Lawndlwd/zync/main"

info()  { printf "\033[1;34m[info]\033[0m  %s\n" "$*"; }
ok()    { printf "\033[1;32m[ok]\033[0m    %s\n" "$*"; }
err()   { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; }

# Check prerequisites
command -v docker &>/dev/null || { err "Docker is required. Install: https://docs.docker.com/get-docker/"; exit 1; }
command -v curl &>/dev/null   || { err "curl is required"; exit 1; }
docker compose version &>/dev/null || { err "Docker Compose v2 is required. Install: https://docs.docker.com/compose/install/"; exit 1; }
docker info &>/dev/null || { err "Docker daemon is not running. Please start Docker and try again."; exit 1; }

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download deployment files
info "Downloading Zync configuration..."
curl -fsSL "$RAW_BASE/docker-compose.prod.yml" -o docker-compose.yml
curl -fsSL "$RAW_BASE/.env.example" -o .env.example
curl -fsSL "$RAW_BASE/install.sh" -o install.sh && chmod +x install.sh

# Create .env from example if it doesn't exist
[ -f .env ] || cp .env.example .env

info "Pulling and starting Zync..."
docker compose pull
docker compose up -d

# Wait for health
info "Waiting for Zync to start..."
PORT="${ZYNC_PORT:-3001}"
HEALTHY=false
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/api/health" &>/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 2
done

if $HEALTHY; then
  ok "Zync is running!"
else
  err "Zync did not become healthy within 60s."
  err "Check logs: cd $INSTALL_DIR && docker compose logs app"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Zync is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Open http://localhost:$PORT to get started"
echo ""
info "Commands:"
echo "  cd $INSTALL_DIR"
echo "  docker compose logs -f                       # View logs"
echo "  docker compose down                          # Stop"
echo "  docker compose pull && docker compose up -d  # Update"
echo ""
