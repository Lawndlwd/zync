#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/tmp/zync-install.log"
exec > >(tee -a "$LOG_FILE") 2>&1

INSTALL_DIR="${ZYNC_DIR:-$HOME/.zync}"
RAW_BASE="https://raw.githubusercontent.com/Lawndlwd/zync/main"
COMPOSE_URL="$RAW_BASE/docker-compose.prod.yml"
SCRIPT_URL="$RAW_BASE/install.sh"
OPENCODE_INSTALL_URL="https://opencode.ai/install"
SKIP_OPENCODE="${SKIP_OPENCODE:-false}"
ZYNC_PORT="${ZYNC_PORT:-8080}"

# --- Helpers ---
info()  { printf "\033[1;34m[info]\033[0m  %s\n" "$*"; }
ok()    { printf "\033[1;32m[ok]\033[0m    %s\n" "$*"; }
warn()  { printf "\033[1;33m[warn]\033[0m  %s\n" "$*"; }
err()   { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; }

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is required but not installed."
    exit 1
  fi
}

# --- Parse flags ---
ENABLE_VOICE=false
DO_UPDATE=false
for arg in "$@"; do
  case "$arg" in
    --update)         DO_UPDATE=true ;;
    --voice)          ENABLE_VOICE=true ;;
    --skip-opencode)  SKIP_OPENCODE=true ;;
    --port=*)         ZYNC_PORT="${arg#--port=}" ;;
    *)                ;;
  esac
done

# --- Detect platform ---
OS="$(uname -s)"
ARCH="$(uname -m)"
info "Detected platform: $OS $ARCH"

# --- Check prerequisites ---
info "Checking prerequisites..."
check_cmd docker
check_cmd curl

if docker compose version &>/dev/null; then
  ok "Docker Compose v2 found ($(docker compose version --short 2>/dev/null || echo "unknown"))"
else
  err "Docker Compose v2 is required. Install it: https://docs.docker.com/compose/install/"
  exit 1
fi

if ! docker info &>/dev/null; then
  err "Docker daemon is not running. Please start Docker and try again."
  exit 1
fi

# --- Install OpenCode ---
install_opencode() {
  if command -v opencode &>/dev/null; then
    ok "OpenCode already installed ($(opencode --version 2>/dev/null || echo "unknown"))"
    return 0
  fi

  if [[ "$SKIP_OPENCODE" == "true" ]]; then
    warn "Skipping OpenCode install (--skip-opencode)"
    warn "Zync works without it, but AI agent features require OpenCode."
    return 0
  fi

  info "Installing OpenCode..."

  local INSTALL_EXIT=0
  curl -fsSL "$OPENCODE_INSTALL_URL" | bash || INSTALL_EXIT=$?

  if [[ "$INSTALL_EXIT" -ne 0 ]]; then
    warn "OpenCode installation failed (exit code: $INSTALL_EXIT)"
    case "$OS" in
      Linux)
        warn "Try: snap install opencode"
        ;;
      Darwin)
        warn "Try: brew install opencode-ai/tap/opencode"
        ;;
    esac
    warn "Zync will continue without OpenCode."
    return 0
  fi

  # Reload shell config so opencode is on PATH
  local SHELL_NAME
  SHELL_NAME="$(basename "${SHELL:-/bin/bash}")"
  case "$SHELL_NAME" in
    zsh)  [[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc" 2>/dev/null || true ;;
    bash) [[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc" 2>/dev/null || true ;;
    fish) info "Fish shell — run 'source ~/.config/fish/config.fish' to refresh PATH" ;;
  esac

  if command -v opencode &>/dev/null; then
    ok "OpenCode installed successfully"
  else
    for CANDIDATE in "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode" "/usr/local/bin/opencode"; do
      if [[ -x "$CANDIDATE" ]]; then
        ok "OpenCode installed at $CANDIDATE (add to PATH or open new terminal)"
        return 0
      fi
    done
    warn "OpenCode installed but not on PATH yet. Open a new terminal."
  fi
}

install_opencode

# --- Setup install directory ---
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# --- Download compose + install script ---
download_files() {
  info "Downloading Zync configuration..."
  curl -fsSL "$COMPOSE_URL" -o docker-compose.yml
  curl -fsSL "$SCRIPT_URL" -o install.sh && chmod +x install.sh
}

# --- Write/update .env without nuking existing values ---
set_env() {
  local key="$1" val="$2"
  touch .env
  if grep -q "^${key}=" .env; then
    # portable sed in-place (works on macOS and Linux)
    local tmp; tmp="$(mktemp)"
    sed "s|^${key}=.*|${key}=${val}|" .env > "$tmp" && mv "$tmp" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

# --- Build compose profiles arg ---
COMPOSE_PROFILES=""
if [[ "$ENABLE_VOICE" == "true" ]]; then
  COMPOSE_PROFILES="--profile voice"
fi

# --- Handle --update ---
if [[ "$DO_UPDATE" == "true" ]]; then
  info "Updating Zync..."
  download_files
  set_env "ZYNC_PORT" "$ZYNC_PORT"
  docker compose $COMPOSE_PROFILES pull
  docker compose $COMPOSE_PROFILES up -d
  ok "Zync containers updated!"
  # fall through to restart opencode serve + print summary
else
  # --- Fresh install ---
  download_files
  set_env "ZYNC_PORT" "$ZYNC_PORT"

  info "Pulling images (this may take a minute on first install)..."
  if [[ "$ENABLE_VOICE" == "true" ]]; then
    info "Voice services enabled (whisper + wakeword)"
  fi
  docker compose $COMPOSE_PROFILES pull
  docker compose $COMPOSE_PROFILES up -d
fi

# --- Wait for backend health ---
info "Waiting for backend to become healthy..."
HEALTHY=false
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health &>/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 2
done

if $HEALTHY; then
  VERSION=$(curl -sf http://localhost:3001/api/health | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  ok "Backend is healthy! (v$VERSION)"
else
  err "Backend did not become healthy within 60s."
  err "Check logs: cd $INSTALL_DIR && docker compose logs backend"
  exit 1
fi

# --- Start OpenCode serve ---
start_opencode() {
  if ! command -v opencode &>/dev/null; then
    warn "OpenCode not found — skipping. AI agent features unavailable."
    return 0
  fi

  # Kill any existing opencode serve process
  pkill -f "opencode serve" 2>/dev/null || true
  sleep 1

  local CORS_ORIGIN="http://localhost:$ZYNC_PORT"
  info "Starting OpenCode serve (CORS: $CORS_ORIGIN)..."

  nohup opencode serve --cors "$CORS_ORIGIN" > "$INSTALL_DIR/opencode.log" 2>&1 &
  local OC_PID=$!

  # Give it a moment to start
  sleep 2

  if kill -0 "$OC_PID" 2>/dev/null; then
    ok "OpenCode running (PID $OC_PID, log: $INSTALL_DIR/opencode.log)"
  else
    warn "OpenCode failed to start. Check: $INSTALL_DIR/opencode.log"
  fi
}

start_opencode

# --- Summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Zync is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Open http://localhost:$ZYNC_PORT to get started"
echo ""
info "Services:"
echo "  Frontend:   http://localhost:$ZYNC_PORT"
echo "  Backend:    http://localhost:3001"
echo "  OpenCode:   http://localhost:4096"
if [[ "$ENABLE_VOICE" == "true" ]]; then
  echo "  Whisper:    internal (voice transcription)"
  echo "  Wakeword:   http://localhost:9000"
fi
echo ""
info "Useful commands:"
echo "  cd $INSTALL_DIR"
echo "  docker compose logs -f              # View logs"
echo "  docker compose down                 # Stop Zync"
echo "  docker compose up -d                # Start Zync"
echo "  ./install.sh --update               # Update to latest"
echo "  ./install.sh --update --voice       # Update with voice services"
echo ""
info "Install log: $LOG_FILE"
info "OpenCode log: $INSTALL_DIR/opencode.log"
