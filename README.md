# Zync

An Obsidian-like workspace over real folders on your server, with **opencode** as the AI and a
**job scheduler** so the AI can do work on its own later ("every Monday at 15:14, …").

- **Files**: a tree of real folders. Pages are markdown files edited in a Notion-style editor.
  Create, rename, drag to move, delete and upload. Changes the AI makes on disk show up live.
- **Chat**: the real [opencode](https://opencode.ai) web UI embedded in the app, opened on the
  current workspace, so skills, MCP servers, plugins, agents and sessions all work. Switching to
  Files and back keeps the conversation (the iframe is never unmounted). Tick **Split chat** to
  keep chat open beside your files.
- **Boards**: kanban boards per workspace. Assign cards to people, including the built-in `@me` and
  `@ai`. An `@ai` card with a run time is done by the AI at that time: it moves to In progress, then
  to Review with a summary. You can also manage boards from chat. See
  [docs/architecture.md](docs/architecture.md).
- **Jobs**: ask the AI in chat to do something at a time or on a schedule. The `schedule-job` skill
  makes it ask clarifying questions, then it creates a job file. At the scheduled time a new
  unattended session runs the task in that workspace, the run is logged, and you get a push
  notification (ntfy) with a link to the session.

```
browser ─► Traefik (Dokploy, HTTPS + basic auth)
            ├─ app.<domain>  → api  (web UI + files/jobs REST)        ┐
            └─ chat.<domain> → opencode web  (iframe inside the app)  ├─ all mount WORKSPACES_HOST_DIR at /workspace
                               └─ zync-jobs MCP → .opencode/jobs/*.md │
            scheduler ─► opencode API → runs jobs, logs, notifies     ┘
```

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
titled `[job] <name> · <time>`: open it from **Jobs → Show history → Open session**.

Jobs run with the `job` agent. It edits files and runs commands without asking, never asks
questions (nobody is there to answer), and is told to stay in its workspace. Its file tools are
confined to the workspace, but its shell commands aren't. Runs are aborted after
`JOB_TIMEOUT_MIN`.

## Deploy on Dokploy

1. DNS: point `ai-app.<domain>` and `ai.<domain>` at the Dokploy server.
2. On the server, create the workspaces folder:
   `mkdir -p /srv/zync/workspaces && chown -R 1000:1000 /srv/zync/workspaces`.
3. Dokploy → **Create Service → Compose**, source = this git repo, compose path `docker-compose.yml`.
4. **Environment**: copy `.env.example` and fill in `DOMAIN`, `BASIC_AUTH_USERS`,
   `WORKSPACES_HOST_DIR`, a provider key and `NTFY_TOPIC`.
   - Generate the auth value with `htpasswd -nbB admin 'password'` and **double every `$`**.
5. Dokploy → **Domains**: add `ai-app.<domain>` → service `api`, port `3001`, and `ai.<domain>` →
   service `opencode`, port `4096` (HTTPS on). Dokploy adds the Traefik routing itself.
6. Deploy, then open `https://ai-app.<domain>`.

The AI server config starts from `opencode/opencode.json` in this repo: on the first start of a fresh
`opencode-config` volume it is copied there and zync merges in its own pieces (zync-jobs MCP, job agent,
skills). From then on edit it in the app (Settings → AI server) and press Restart; the repo file is only
the seed. Keep secrets out of it — reference them as `{env:NAME}` and set NAME in Dokploy → Environment.
Provider logins done in the chat UI persist in the `opencode-data` volume.

> **Security:** the chat (and every job) can run any shell command on the mounted folders. Keep
> basic auth on, and use a long password. The containers refuse to start without
> `BASIC_AUTH_USERS`.

## Local

```sh
# Docker, same images as production, no auth, ports on localhost:
WORKSPACES_HOST_DIR=$PWD/data/workspaces DOMAIN=localhost \
  docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
# app http://localhost:3001 · chat http://localhost:4096
```

Without Docker (Node 24 or later, pnpm, opencode installed):

```sh
pnpm install && pnpm build
pnpm dev:opencode                                  # opencode web on :4096 over data/workspaces
WORKSPACES_ROOT=$PWD/data/workspaces pnpm dev      # api :3001 (+ scheduler), web :5173
```

`pnpm dev:opencode` writes its own config to `data/.opencode-dev/` and leaves `~/.config/opencode`
alone. If the `schedule-job` skill doesn't show up locally (some global opencode plugins hide
extra skill paths), link it:
`ln -s $PWD/opencode/skills/schedule-job ~/.config/opencode/skills/`.

## Repo layout

| Path | What |
| --- | --- |
| `packages/web` | React UI: workspace switcher, file tree, markdown editor, jobs, embedded chat |
| `packages/api` | Express: workspace file API (traversal-safe), jobs API, live file events (SSE); serves the web build |
| `packages/jobs` | Job files, scheduler service, `zync-jobs` MCP server, opencode HTTP client, ntfy |
| `opencode/` | `configure.mjs` (merges MCP, skills and the `job` agent into opencode's config) and the skills |
| `docker/`, `Dockerfile`, `docker-compose*.yml` | One image, three roles: `api`, `opencode`, `scheduler` |

`pnpm test` runs the vitest suites (job parsing and validation, path safety, file and jobs routes).
The previous app is preserved at git tag `legacy-v1`.
