# Zync

A self-hosted personal productivity dashboard for developers.
Connects your tools — Jira, GitLab, Telegram — and uses AI to help
you manage, prioritize, and act on your work from a single interface.

## Features

- **AI Chat** — Conversational agent powered by [OpenCode](https://opencode.ai) with
  tool calling (create tasks, transition Jira issues, draft replies, summarize sprints)
- **Jira Integration** — View assigned issues, transition statuses, add comments, detect blockers
- **GitLab** — MR review queue, pipeline stats, project overview
- **Daily Journal** — Rich text editor with AI-assisted standup generation, weekly recaps, and focus suggestions
- **Productivity Tracking** — Habits, activity log, token usage stats
- **Canvas** — AI-powered workspace for brainstorming and structured tasks
- **Todos** — Personal task list linked to Jira issues with AI-generated sub-tasks
- **Telegram Bot** — Chat with your agent, get daily briefings, proactive notifications
- **WhatsApp Channel** — Message your agent via WhatsApp
- **Documents** — Project knowledge base with search
- **Daily Digest** — AI-generated briefing of open issues, unread messages, and sprint status
- **Dark mode** by default

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/Lawndlwd/zync/main/install.sh | bash
```

This will:
1. Install [OpenCode](https://opencode.ai) if not already installed
2. Pull pre-built Docker images (frontend, backend, whisper, wakeword)
3. Start all services
4. Launch `opencode serve` with CORS configured

### Update

```bash
cd ~/.zync
./install.sh --update
```

## Services

| Service    | URL                    | Description                |
|------------|------------------------|----------------------------|
| Frontend   | http://localhost:8080   | Dashboard UI               |
| Backend    | http://localhost:3001   | API server                 |
| OpenCode   | http://localhost:4096   | AI agent (runs on host)    |
| Whisper    | internal               | Voice transcription        |
| Wakeword   | http://localhost:9000   | Voice activation           |

## Configuration

After install, add your API keys and integration config to `~/.zync/.env`:

```env
ZYNC_PORT=8080

# Integrations (configured via the Settings page)
JIRA_URL=https://your-instance.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...

GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=...

TELEGRAM_BOT_TOKEN=...
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express
- **AI**: OpenCode (supports any provider — Anthropic, OpenAI, local models via Ollama)
- **State**: Zustand + TanStack Query
- **Storage**: SQLite
- **Deploy**: Docker Compose (frontend via nginx, backend via Node)

## Development

```bash
git clone https://github.com/Lawndlwd/zync.git
cd zync

# Frontend
pnpm install
pnpm dev

# Backend
cd server
pnpm install
pnpm dev

# Or build and run everything locally with Docker
docker compose up -d --build
```

## Useful Commands

```bash
cd ~/.zync
docker compose logs -f           # View logs
docker compose down              # Stop Zync
docker compose up -d             # Start Zync
./install.sh --update            # Update to latest
```
