# AI Dashboard

A personal AI agent dashboard for frontend developers. Connects to Jira, messaging, and LLMs to help manage, prioritize, and act on your work — all in one place.

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (`corepack enable pnpm`)
- A Jira Cloud account (for Jira integration)
- Ollama running locally (for AI features) or an OpenAI API key

### Setup

```bash
# Install dependencies
pnpm install
cd server && pnpm install && cd ..

# Configure environment
cp .env.example server/.env
# Edit server/.env with your credentials

# Start both frontend and backend
pnpm dev:all
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001`.

### Connecting Jira

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create an API token
3. Set in `server/.env`:
   ```
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@company.com
   JIRA_API_TOKEN=your-token
   ```

### Configuring the LLM

**Ollama (local, default):**
```
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=llama3.2
```

**OpenAI:**
```
LLM_BASE_URL=https://api.openai.com
LLM_MODEL=gpt-4
LLM_API_KEY=sk-...
```

## Features

- **Dashboard** — Daily overview with stats, sprint progress, AI briefing
- **Jira Panel** — View/search issues, transition statuses, add comments, AI-generated TODO checklists
- **To-Do List** — Local persistent todos linked to Jira issues, priority-based
- **Inbox** — Messages from Slack/custom source with AI summaries and reply drafts
- **Journal** — Daily rich-text journal with TipTap editor, AI fill focus, standup generator
- **AI Agent** — Side panel chat with tool calling (Jira, todos, messages, sprint)
- **Settings** — Configure all integrations from the UI

## Keyboard Shortcuts

- `Cmd/Ctrl + J` — Open today's journal
- `Cmd/Ctrl + K` — Toggle AI Agent chat
- `Cmd/Ctrl + Shift + F` — Fullscreen journal mode

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- Zustand (state management)
- TanStack Query (data fetching)
- React Router v6
- TipTap (rich text editor)
- Express (backend proxy)
- Ollama / OpenAI (AI)

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Frontend: `http://localhost:8080` | Backend: `http://localhost:3001`

## Project Structure

```
src/
├── components/
│   ├── ai-agent/    # Chat panel
│   ├── jira/        # Issue cards, detail view
│   ├── layout/      # Sidebar, app layout
│   └── ui/          # Button, Card, Badge, Input, Skeleton, ErrorBoundary
├── hooks/           # useJiraIssues, useMessages, useAIAgent
├── store/           # Zustand stores (settings, todos, journal, chat)
├── services/        # API service layer (jira, llm, messages)
├── types/           # TypeScript interfaces
└── pages/           # Route pages
server/
└── src/routes/      # Express proxy routes (jira, llm, messages)
```
