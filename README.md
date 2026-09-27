# Zync

An Obsidian-like workspace over real folders on your server, with **opencode** as the AI and a
**job scheduler** so the AI can do work on its own later ("every Monday at 15:14, …").

- **Files**: a tree of real folders. Pages are markdown files edited in a Notion-style editor.
  Create, rename, drag to move, delete and upload. Changes the AI makes on disk show up live.
- **Chat**: the real [opencode](https://opencode.ai) web UI docked in the app (⌘J), opened on the
  current workspace, so skills, MCP servers, plugins, agents and sessions all work. It's served
  through the app's own domain, and stays mounted while you move around. Its config
  (`opencode.json`) is editable in **Settings → AI server**, with a restart button.
- **Boards**: kanban boards per workspace. Assign cards to people, including the built-in `@me` and
  `@ai`. An `@ai` card with a run time is done by the AI at that time: it moves to In progress, then
  to Review with a summary. A card is just a markdown file in the board's folder. You can also
  manage boards from chat.
- **Memory**: the AI remembers you across chats and jobs. Every person has a notes page (who they
  are, how to work with them; `@me` is you, `@ai` is how the AI should work), and memories are
  small markdown pages (rules, preferences, habits, facts), global or per workspace. The AI reads
  them on every message and saves what it learns ("remember…", "from now on…"); you read and edit
  everything on the **Memory** page. Done by zync's opencode plugin, no external service.
- **Jobs**: ask the AI in chat to do something at a time or on a schedule. The `schedule-job` skill
  makes it ask clarifying questions, then it creates a job file. At the scheduled time a new
  unattended session runs the task in that workspace, the run is logged, and you get a push
  notification (ntfy) with a link to the session.

```
browser ─► Traefik (Dokploy, HTTPS) ─► <your host> → api :3001            ┐
             /, /w/*        the web app                                  │
             /zync/api/*    files, boards, jobs, settings REST           ├─ all mount WORKSPACES_HOST_DIR
             everything else → forwarded to opencode :4096 (the chat UI) │  at /workspace
                               └─ zync-jobs MCP → .opencode/jobs/*.md    │
           scheduler ─► opencode API → runs jobs, logs, notifies         ┘
```
opencode has no public address: only the api (and the scheduler) reach it, inside the compose network.

## Workspaces

Every subfolder of `WORKSPACES_HOST_DIR` is a workspace (create one from the workspace menu or with
`mkdir`). Jobs for a workspace live in `<workspace>/.opencode/jobs/`:

```md
---
name: weekly-report
schedule: "14 15 * * 1"      # cron (Mondays 15:14), or instead:
# at: 2026-09-28T15:14       # one-shot; turns itself off after running
timezone: Europe/Paris       # optional, defaults to TZ
context: [notes/, data/q3.csv]   # read before starting
notify: always               # always | failure | never
enabled: true
# agent: job                 # default: the unattended "job" agent
# model: anthropic/claude-sonnet-5
---
Summarise this week's notes into reports/<ISO week>.md …
```

Runs are appended to `<name>.runs.jsonl` next to the job. Each run is a normal opencode session
titled `[job] <name> · <time>`: open it from **Jobs → Run history → [Open session ↗]**.

Jobs run with the `job` agent. It edits files and runs commands without asking, never asks
questions (nobody is there to answer), and is told to stay in its workspace. Its file tools are
confined to the workspace, but its shell commands aren't. Runs are aborted after
`JOB_TIMEOUT_MIN`.

## Deploy on Dokploy

1. DNS: point your host (e.g. `zync.example.com`) at the Dokploy server.
2. Pick a host folder for the workspaces (e.g. `/srv/zync/workspaces`). It may be missing or
   root-owned: the containers hand it to their `node` user (uid 1000) on every start.
3. Dokploy → **Create Service → Compose**, source = this git repo, compose path `docker-compose.yml`.
4. **Environment**: copy `.env.example` and fill in `APP_URL`, `WORKSPACES_HOST_DIR`, your provider
   keys, `NTFY_TOPIC`, and `ALLOW_NO_AUTH=1` (read the security note below first).
5. Dokploy → **Domains**: one domain, your host → service `api`, port `3001`, HTTPS on.
   Nothing for `opencode` or `scheduler`.
6. Deploy, then open `APP_URL`.

The AI server config starts from `opencode/opencode.json` in this repo: on the first start of a fresh
`opencode-config` volume it is copied there and zync merges in its own pieces (zync-jobs MCP, job agent,
skills). From then on edit it in the app (Settings → AI server) and press Restart; the repo file is only
the seed. Keep secrets out of it — reference them as `{env:NAME}` and set NAME in Dokploy → Environment.
Provider logins done in the chat UI persist in the `opencode-data` volume.

> **Security:** the chat (and every job) can run any shell command on the mounted folders, and
> zync has **no login** yet. Only expose it behind access control (VPN, IP allow-list…). The app
> refuses to start until you set `ALLOW_NO_AUTH=1` to acknowledge this.

## Local

```sh
# Docker, same image as production, no login, on localhost:
WORKSPACES_HOST_DIR=$PWD/data/workspaces \
  docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
# http://localhost:3001
```

Without Docker (Node 24 or later, pnpm, opencode installed):

```sh
pnpm install && pnpm build
pnpm dev:opencode      # opencode on :4096
pnpm dev               # api :3001 (+ scheduler), web :5173 — open http://localhost:5173
```

Both use `WORKSPACES_ROOT` (default `data/workspaces`). Keep workspaces **outside** any git repo
(e.g. `WORKSPACES_ROOT=~/zync-workspaces` for both commands): inside one, opencode treats the whole
repo as the project and its `@` file list misses new files. Put provider keys in `.env`.

`pnpm dev:opencode` copies `opencode/opencode.json` once to `data/opencode/config/` (the same file the
app's Settings edits), merges in zync's pieces, and never reads or touches `~/.config/opencode`.

## Repo layout

| Path | What |
| --- | --- |
| `packages/web` | React UI (zync design): overview, files, boards, jobs, people, settings, chat dock |
| `packages/api` | Express: files/boards/jobs/settings API under `/zync/api`, live file events, serves the web build and forwards the chat to opencode |
| `packages/jobs` | Job files, scheduler service, `zync-jobs` MCP server, opencode memory plugin, opencode HTTP client, ntfy |
| `opencode/` | `opencode.json` (config seed), `configure.mjs` (merges MCP, skills, the memory plugin and the `job` agent into it) and the skills |
| `docker/`, `Dockerfile`, `docker-compose*.yml` | One image, three roles: `api`, `opencode`, `scheduler` |

`pnpm test` runs the vitest suites (job parsing and validation, path safety, file and jobs routes).
The previous app is preserved at git tag `legacy-v1`.
