# Zync

A self-hosted, AI-powered personal operating system.
Plan your life, track habits, chat with an AI agent that has access to your
tools, and manage everything from a single dashboard.

## Features

- **Life OS** — Personal planning framework: vision, anti-vision, 1-year goals, monthly projects, daily levers, XP/level system with streaks
- **AI Chat** — Conversational agent powered by [OpenCode](https://opencode.ai) with MCP tool calling
- **Projects** — Kanban board with priority and assignee filters
- **Documents** — Knowledge base with rich text editor
- **Canvas** — Live AI-rendered HTML/CSS/JS workspace
- **Productivity** — Habit tracking with heatmaps, morning/evening journaling
- **Activity** — AI token usage and cost analytics
- **Vault** — Encrypted secret management with PIN protection
- **Channels** — Talk to your agent via Telegram, WhatsApp, or Gmail
- **Briefings** — Scheduled AI-generated summaries (configurable cron)
- **Google Workspace** — Gmail, Calendar, Drive, Contacts, Tasks (via MCP tools)
- **Voice** — Wake word detection + Whisper transcription
- **Dashboard** — Personal overview with configurable widgets
- **Dark mode** by default

## Quick Start

> **Prerequisite**: [OpenCode](https://opencode.ai) must be installed and running (`opencode serve`).

```bash
curl -fsSL https://raw.githubusercontent.com/Lawndlwd/zync/main/install.sh | bash
```

This will:
1. Download the production Docker Compose config
2. Pull pre-built Docker images
3. Start the app on port 3001

Open **http://localhost:3001** once it's running.

### Update

```bash
cd ~/.zync
docker compose pull && docker compose up -d
```

## Services

### Production (`docker-compose.prod.yml`)

| Service  | Port | Description                          |
|----------|------|--------------------------------------|
| App      | 3001 | Unified frontend + API server        |
| Whisper  | —    | Voice transcription                  |
| Wakeword | —    | Wake word detection                  |

### Development (`docker-compose.yml`)

| Service  | Port | Description              |
|----------|------|--------------------------|
| Frontend | 8080 | Vite dev server          |
| Backend  | 3001 | Express API server       |
| OpenCode | 4096 | AI agent (runs on host)  |
| Whisper  | —    | Voice transcription      |
| Wakeword | —    | Wake word detection      |

## Configuration

Configured through the **Settings** page in the UI:

- **Integrations** — Telegram, WhatsApp, Gmail
- **Agent Profile** — Identity, instructions, memories
- **Schedules** — Recurring AI tasks (cron)
- **Tools** — Enable/disable MCP tool groups (web, canvas, files, shell, Google Workspace, etc.)
- **Vault** — Encrypted secret storage
- **Briefings** — Daily AI digest scheduling

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express
- **AI**: [OpenCode](https://opencode.ai) (supports Anthropic, OpenAI, Ollama)
- **Monorepo**: pnpm workspaces + Turborepo
- **Shared**: `@zync/shared` package for common types and utilities
- **State**: Zustand + TanStack Query
- **Storage**: SQLite
- **Linting**: Biome
- **Voice**: Whisper (transcription) + OpenWakeWord (wake word detection)
- **Deploy**: Docker Compose

## Project Structure

```
packages/
  app/       — React frontend (@zync/app)
  server/    — Express API server (@zync/server)
  shared/    — Shared types and utilities (@zync/shared)
  whisper/   — Whisper transcription service (Python)
  wakeword/  — Wake word detection service (Python)
```

## Development

```bash
git clone https://github.com/Lawndlwd/zync.git
cd zync
pnpm install

# Start OpenCode (prerequisite)
opencode serve

# Start frontend + backend (via Turborepo)
pnpm dev

# Start everything including voice services
pnpm dev:all

# Or run with Docker
docker compose up -d --build
```

## Useful Commands

```bash
# Development
pnpm dev                # Start app + server
pnpm dev:all            # Start all services including voice
pnpm build              # Build all packages
pnpm typecheck          # Type-check all packages
pnpm lint               # Lint with Biome
pnpm lint:fix           # Lint and auto-fix

# Docker (production)
cd ~/.zync
docker compose logs -f                       # View logs
docker compose down                          # Stop
docker compose pull && docker compose up -d  # Update
docker compose --profile voice up -d         # Enable voice
```
