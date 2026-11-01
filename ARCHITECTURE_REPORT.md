# Zync architecture report

Scope: the whole repository as it stands in the working tree on 2026-10-01, including the
uncommitted work (`becoming/`, `training/`, the new routes and skills). Every claim cites the file
it comes from. Where the repo's own prose docs disagree with the code, the code wins and the
disagreement is listed in [section 13](#13-doc-drift-and-things-worth-a-look).

## Contents

1. [TL;DR](#1-tldr)
2. [System overview and runtime](#2-system-overview-and-runtime)
3. [Monorepo and packages](#3-monorepo-and-packages)
4. [Data and persistence](#4-data-and-persistence)
5. [Data flow](#5-data-flow)
6. [Domains](#6-domains)
7. [AI integration](#7-ai-integration)
8. [Security and auth](#8-security-and-auth)
9. [Frontend architecture](#9-frontend-architecture)
10. [Build, dev and quality tooling](#10-build-dev-and-quality-tooling)
11. [Deployment](#11-deployment)
12. [Files vs a database: trade-offs and recommendations](#12-files-vs-a-database-trade-offs-and-recommendations)
13. [Doc drift and things worth a look](#13-doc-drift-and-things-worth-a-look)

---

## 1. TL;DR

**Do we use a database? No.** There is no SQL or NoSQL engine, no ORM, no embedded store (SQLite,
LevelDB, lowdb…) and no database client in any `package.json`
(`packages/{api,jobs,web}/package.json`; the dependencies are Express, chokidar, zod, croner,
gray-matter, jose, @simplewebauthn, `telegram`, the MCP SDK, React, TanStack Query, Milkdown,
CodeMirror, `yaml`). The browser uses no IndexedDB.

Why, in the project's own words (`docs/architecture.md`, "the filesystem is the database"): the
user's data is plain files in real folders, so that **the UI, the AI (opencode), the scheduler and
the user (`ls`, `git`, an editor) all read and write the same thing**. That buys:

- live sync for free (a file watcher turns any write, by anyone, into a UI refresh),
- no service-to-service state protocol (the api "runs a job" by dropping a file the scheduler picks up),
- backups are `cp -r` or git,
- the AI can use ordinary file tools on the same data the app shows.

What takes the place of a database:

| Database feature | Zync's substitute |
| --- | --- |
| Tables / rows | Folders / one markdown file per record (frontmatter = columns, body = text) |
| Append-only tables | `.jsonl` files (job runs, votes, activity, body weight) |
| Schema + constraints | zod schemas next to each file format (`packages/jobs/src/**/types.ts`), lenient on read |
| Indexes / queries | None. Every list is a directory scan; search is a bounded file walk (`packages/api/src/search.ts`) |
| Change feed | chokidar watcher to Server-Sent Events (`packages/api/src/events.ts`) |
| Transactions | None for workspace files. Atomic tmp+rename only for the two secret stores and opencode's config |
| Auth/secret storage | Two small JSON files in separate volumes (`auth.json`, `connections.json`), loaded into memory once, rewritten atomically |

The only things outside the workspaces folder are the auth file, the connections file, opencode's
own data volume (opencode's internal, not Zync's) and a handful of UI preferences in the browser's
`localStorage`. Nothing database-like was found anywhere else (see [section 4.3](#43-in-memory-state-that-looks-like-storage-but-is-not)).

---

## 2. System overview and runtime

One Docker image runs three roles selected by the container command (`Dockerfile`,
`docker/entrypoint.sh`), plus a stock `cloudflared` container. Nothing publishes a port.

```
                         Internet
                            |
                 Cloudflare edge: Access (email + PIN)
                            |  outbound tunnel (dialed by cloudflared)
 +--------------------------+--------------------------------------------------+
 | Docker host (Dokploy compose project)                                       |
 |                                                                             |
 |  network "tunnel"          network "default"                                |
 |  +------------+            +-----------------------------------------+      |
 |  | cloudflared|--:3001---->|  api  (role "api")                      |      |
 |  +------------+   (only    |   Express 5, SPA, REST /zync/api,       |      |
 |       ^           api is on|   SSE, passkeys, opencode proxy         |      |
 |       |           both     |   :3001 public side (via tunnel only)   |      |
 |   TUNNEL_TOKEN    nets)    |   :3002 internal (AI tools, bearer)     |      |
 |                            +----+----------------------+-------------+      |
 |                                 | HTTP proxy + REST    ^ HTTP :3002        |
 |                                 v                      | (ZYNC_INTERNAL_     |
 |  +-----------------------------------------+           |  TOKEN)             |
 |  | opencode (role "opencode")  :4096       |-----------+                     |
 |  |  opencode serve (supervised by run.sh)  |                                 |
 |  |   +-- child: zync-jobs MCP (stdio)      |                                 |
 |  |   +-- plugin: opencode-plugin.js        |                                 |
 |  +--------------------^--------------------+                                 |
 |                       | HTTP :4096 + /global/event SSE                       |
 |  +--------------------+--------------------+                                 |
 |  | scheduler (role "scheduler")  no port   |--> ntfy (HTTPS, outbound)       |
 |  |  cron, run-now triggers, run log,       |                                 |
 |  |  activity recorder, becoming daily      |                                 |
 |  +-----------------------------------------+                                 |
 |                                                                              |
 |  Volumes: /workspace (host bind, all 3 roles) . zync-auth (api only)         |
 |           zync-connections (api only) . opencode-config (api + opencode)     |
 |           opencode-data (opencode only)                                      |
 +------------------------------------------------------------------------------+
```

Sources: `docker-compose.yml`, `docker/entrypoint.sh`, `packages/api/src/index.ts`,
`docs/zero-trust-deploy.md`.

| Service | Ports | Networks | Mounts | Notes |
| --- | --- | --- | --- | --- |
| `api` | 3001 (app + API, `expose` only), 3002 (internal AI tools, only if `ZYNC_INTERNAL_TOKEN` is set, `packages/api/src/index.ts`) | `default`, `tunnel` | `/workspace`, `opencode-config`, `zync-auth`, `zync-connections` | healthcheck `curl /zync/api/health` |
| `opencode` | 4096 (`expose` only) | `default` | `/workspace`, `opencode-config` (at `~/.config/opencode`), `opencode-data` (at `~/.local/share/opencode`) | holds the provider API keys; runs the MCP server and plugin as in-process children |
| `scheduler` | none | `default` | `/workspace` | `depends_on: opencode`; no auth volume, no connections volume |
| `cloudflared` | none | `tunnel` | none | `TUNNEL_TOKEN` from `CLOUDFLARE_TUNNEL_TOKEN`; the tunnel route points at `http://api:3001` |

Local development (`pnpm dev`, `README.md`) runs the same code without Docker: api on 3001,
scheduler, Vite on 5173 proxying `/zync/api` and everything non-app to the api
(`packages/web/vite.config.ts`), and `pnpm dev:opencode` (`scripts/dev-opencode.sh`) for opencode
on 4096 over `data/workspaces`. `docker-compose.local.yml` publishes 3001 on `127.0.0.1` and puts
`cloudflared` behind a profile so it does not start.

URL space (`packages/api/src/app.ts`, `spa.ts`): the app owns `/`, `/login`, `/w/*` and `/zync/*`
(`/zync/api` for REST, `/zync/assets` for the built JS). Every other path is forwarded to opencode
(HTTP, event streams and WebSocket upgrades, `opencode-proxy.ts`). That is how opencode's web UI is
served on the same origin, inside an iframe, without a second public hostname.

---

## 3. Monorepo and packages

pnpm workspaces (`pnpm-workspace.yaml`: `packages/*`) + Turborepo (`turbo.json`). Node >= 24,
pnpm 10.29, TypeScript 7, ESM everywhere (`"type": "module"`), strict tsconfig with
`noUncheckedIndexedAccess` and `verbatimModuleSyntax` (`tsconfig.base.json`).

```
            +-----------------+
            |  packages/web   |   React SPA (built to static files)
            +--------+--------+
                     | HTTP /zync/api (no code dependency)
            +--------v--------+        +--------------------+
            |  packages/api   |------->|   packages/jobs    |<-- opencode/ (MCP, plugin)
            |  Express 5      | import |   domain library   |<-- scheduler process
            +-----------------+        |   no HTTP server   |
                                       +--------------------+
```

`web` does not import `@zync/jobs`; it only talks HTTP. `api` imports `@zync/jobs` (workspace
dependency). `jobs` depends on nothing internal.

| Package | Responsibility | Key files | Notable dependencies |
| --- | --- | --- | --- |
| `@zync/jobs` (`packages/jobs`) | The domain library: parses, validates and writes every file format; plus three executables | domain folders `boards/ calendar/ memory/ people/ briefs/ becoming/ training/ connections/ mcp/`; root files `job-file.ts`, `runs.ts`, `workspaces.ts` (`safeResolve`), `frontmatter.ts`, `errors.ts`, `notify.ts`, `opencode.ts` (HTTP client for opencode), `active-runs.ts`; entry points `scheduler.ts`, `mcp.ts`, `opencode-plugin.ts` (these three stay at the root because Docker and `opencode/configure.mjs` load their `dist/` files, `knip.json` lists them as entries) | `zod`, `croner`, `gray-matter`, `@modelcontextprotocol/sdk` |
| `@zync/api` (`packages/api`) | Thin HTTP layer over the library, auth gate, SSE, SPA hosting, opencode reverse proxy, connections to outside accounts | `app.ts` (router wiring), `index.ts` (listen, WS upgrade, internal port), `*-routes.ts` (one router per area), `body.ts` (zod request bodies), `events.ts`, `search.ts`, `spa.ts`, `opencode-proxy.ts`, `internal.ts`, `middleware/error-handler.ts`, `auth/`, `connections/`, `opencode-library*.ts` | `express` 5, `zod`, `chokidar`, `jose`, `@simplewebauthn/server`, `multer`, `telegram` (GramJS) |
| `@zync/web` (`packages/web`) | The SPA | `main.tsx`, `routes.tsx`, `api.ts` (the only HTTP client), `shell/`, `hooks/`, `components/`, one folder per view, `helpers/`, `types/` | `react` 19 + React Compiler, `@tanstack/react-query`, `react-router` 7, `vite` 7, `@milkdown/crepe`, CodeMirror 6, `@simplewebauthn/browser`, `yaml` |
| `opencode/` (not a package) | Seed config and wiring for the product's AI server | `opencode.json` (only `$schema`), `configure.mjs`, `run.sh`, `skills/*/SKILL.md` | none |
| `.opencode/` (not shipped) | Rules and skills for the coding agents that work on this repo, never read by the product AI | `knowledges/architecture.md`, `skills/dev-*` | none |

Layering rules enforced by convention and lint (`AGENTS.md`, `oxlint.config.ts`): one component or
hook per file, helpers in `src/helpers/<topic>.ts`, domain types in `src/types/`, `type` over
`interface`, `import/no-cycle` is an error, zod at every boundary.

Errors carry an HTTP status through `httpError / badRequest / notFound / conflict`
(`packages/jobs/src/errors.ts`), so the library can signal "404" or "409" without knowing about
Express. `packages/api/src/middleware/error-handler.ts` maps `ZodError` to 400, `status` to itself,
`ENOENT` to 404, `EEXIST` to 409, anything else to 500.

---

## 4. Data and persistence

### 4.1 Where everything lives

`WORKSPACES_ROOT` is `/workspace` in Docker and `<repo>/data/workspaces` locally
(`packages/jobs/src/workspaces.ts`). Every visible subfolder of the root is a **workspace**
(`listWorkspaces`). Zync's own data sits in dot-folders (`.zync/`, `.opencode/`) or in clearly named
folders (`Calendar/`, `Briefs/`, `Becoming/`, `Training/`) inside a workspace, so it is ordinary,
visible, editable content.

```
WORKSPACES_ROOT/
├── .zync/                                  GLOBAL (shared by every workspace)
│   ├── people.json                         people list (me, ai built in)
│   ├── people/<id>.md                      what the AI knows about a person
│   └── memory/<Title>.md                   global memories
└── <workspace>/
    ├── <any>.md, folders, binaries         the user's files
    ├── <board folder>/.board.json          marks a folder as a board (columns)
    ├── <board folder>/<Title>.md           a card = a file
    ├── Calendar/<Title>.md                 calendar events
    ├── Briefs/<YYYY-MM-DD>.md              daily briefs
    ├── Becoming/<identity>.md              identities
    ├── Becoming/.votes.jsonl               votes (append-only)
    ├── Becoming/Mirror/<YYYY-Www>.md       weekly mirrors
    ├── Training/profile.md                 training profile
    ├── Training/Routines/<Title>.md        routines
    ├── Training/Log/<date>-<slug>.md       workouts
    ├── Training/Exercises/<slug>.md        custom exercises
    ├── Training/.body.jsonl                body weight (append-only)
    ├── .zync/memory/<Title>.md             workspace memories
    ├── .zync/order.json                    sidebar order of entries
    ├── .zync/activity.jsonl                what the user edited, per file per minute
    └── .opencode/jobs/
        ├── <name>.md                       job definition
        ├── <name>.runs.jsonl               run log (append-only)
        ├── .trigger/<name>                 "run now" request (consumed)
        └── .running/<name>.json            run in progress marker
```

### 4.2 Full persistence table

| Data | Where on disk | Format | Who writes it | Code |
| --- | --- | --- | --- | --- |
| Workspaces | a subfolder of `WORKSPACES_ROOT` | directory | api (`POST /workspaces`), user, AI | `jobs/src/workspaces.ts` |
| Pages and any user file | `<ws>/**` | md / any | api (`PUT /file/*`, upload via multer), user's editor, the AI's file tools | `api/src/fs-routes.ts` |
| Boards | `<folder>/.board.json` | JSON `{columns:[{id,name}]}` | api, MCP tools | `jobs/src/boards/board-file.ts`, `boards.ts` |
| Cards | `<board folder>/<Title>.md` (title = file name) | md, frontmatter (`status`, `assignee`, `due`, `labels`, `runAt`, `context`, `order`, `ai:`) + body | api, MCP, scheduler (`ai.state`, column moves), user editor | `jobs/src/boards/card-file.ts`, `card-io.ts`, `cards.ts` |
| Jobs | `<ws>/.opencode/jobs/<name>.md` | md, frontmatter (`schedule`/`at`, `timezone`, `context`, `notify`, `enabled`, `agent`, `model`, `card`) + instructions | api, MCP `create_job`/`update_job`, scheduler (disables one-shots), card sync | `jobs/src/job-file.ts` |
| Job run log | `<ws>/.opencode/jobs/<name>.runs.jsonl` | JSONL, one `RunRecord` per run | scheduler only | `jobs/src/runs.ts` |
| Run-now request | `<ws>/.opencode/jobs/.trigger/<name>` | empty marker file | api, MCP; consumed (deleted) by scheduler on its next scan (<= 5 s) | `job-file.ts` (`TRIGGER_DIR`), `scheduler.ts` `consumeTriggers` |
| Run in progress | `<ws>/.opencode/jobs/.running/<name>.json` | JSON `{sessionId, started, trigger}` | scheduler (write at start, delete at end, wipe on boot) | `jobs/src/active-runs.ts` |
| Calendar events | `<ws>/Calendar/<Title>.md` | md, frontmatter (`start`, `end`, `people`, `repeat`) + notes | api, MCP | `jobs/src/calendar/events.ts`, `event-file.ts` |
| Daily briefs | `<ws>/Briefs/<date>.md` | md, `sources:` frontmatter + checklist + text | MCP `write_brief` (run by the `daily-brief` job), api (tick, link to card) | `jobs/src/briefs/` |
| Memories (global) | `<root>/.zync/memory/<Title>.md` | md, frontmatter (`type`, `description`, `pinned`) + body | api, opencode plugin tools `memory_save`/`memory_delete` | `jobs/src/memory/store.ts`, `helpers/paths.ts` |
| Memories (workspace) | `<ws>/.zync/memory/<Title>.md` | same | same | same |
| People | `<root>/.zync/people.json` | JSON array of `{id,name,color}`; `me` and `ai` are code constants | api, MCP `add_person`, plugin | `jobs/src/people/people.ts` |
| Person notes | `<root>/.zync/people/<id>.md` | md | api, plugin `person_note` | `jobs/src/people/notes.ts` |
| Sidebar order | `<ws>/.zync/order.json` | JSON | api `PUT /order` | `helpers/paths.ts` (`treeOrderPath`), `api/src/tree-order.ts` |
| Activity log | `<ws>/.zync/activity.jsonl` | JSONL, one line per file per minute | scheduler's `ActivityRecorder` (uses `fs.watch`) | `jobs/src/becoming/recorder.ts`, `activity.ts` |
| Identities (Becoming) | `<ws>/Becoming/<slug>.md` | md, frontmatter (`statement`, `action`, `small`, `when`, `minutes`, `signals`, `guards`, `stage`, `since`, `stageSince`) + why + `## Proof` | api, MCP `create_identity`/`update_identity` | `jobs/src/becoming/store.ts`, `identity-file.ts`, `types.ts` |
| Votes | `<ws>/Becoming/.votes.jsonl` | JSONL; last line per (date, identity) wins; `clear` kind removes | api (tap), MCP `vote`, scheduler (automatic votes from evidence) | `jobs/src/becoming/votes.ts` |
| Mirrors | `<ws>/Becoming/Mirror/<YYYY-Www>.md` | md, frontmatter (`stats`, `facts`, `questions`, `change`, `generated`) + body | MCP `write_mirror` (run by the `mirror-weekly` job) | `jobs/src/becoming/mirror.ts` |
| Training profile | `<ws>/Training/profile.md` | md frontmatter | api, MCP `save_training_profile` | `jobs/src/training/profile.ts` |
| Routines | `<ws>/Training/Routines/<Title>.md` | md | api, MCP `save_routine` | `jobs/src/training/routines.ts` |
| Workouts | `<ws>/Training/Log/<date>-<slug>.md` (no `endedAt` = in progress, one at a time) | md | api, MCP `log_workout` | `jobs/src/training/workouts.ts`, `finish.ts` |
| Custom exercises | `<ws>/Training/Exercises/<slug>.md` (id `custom:<slug>`) | md | api | `jobs/src/training/custom-exercises.ts` |
| Body weight | `<ws>/Training/.body.jsonl` | JSONL, last entry per date wins | api | `jobs/src/training/body-weight.ts` |
| Built-in exercise catalog | `packages/jobs/assets/exercises.json` (read-only, shipped in the image) | JSON | nobody at runtime | `jobs/src/training/catalog.ts`, `Dockerfile` |
| Auth (passkeys, recovery-code hashes, sessions) | `$ZYNC_AUTH_DIR/auth.json` (`/zync-auth` volume; dev: `data/auth`) | JSON, file 0600 in dir 0700, zod-validated, atomic tmp+rename | api only | `api/src/auth/store.ts` |
| Connections (Google refresh token, Slack token, Telegram session) | `$ZYNC_CONNECTIONS_DIR/connections.json` (`/zync-connections` volume; dev: `data/connections`) | JSON 0600/0700, atomic tmp+rename, secrets stored as-is (they must be usable) | api only | `api/src/connections/store.ts` |
| opencode config (`opencode.json`, agents, commands, skills) | `opencode-config` volume at `~/.config/opencode` (seeded once from `opencode/opencode.json`, then the volume copy is the truth) | JSON + md | api (Settings: AI server, OpenCode page, atomic + mtime-checked), `opencode/configure.mjs` at every opencode (re)start | `api/src/opencode-config-routes.ts`, `opencode-library.ts`, `opencode/configure.mjs` |
| opencode's own state (chat sessions, provider logins) | `opencode-data` volume at `~/.local/share/opencode` | opencode internal | opencode only. Not Zync's data; Zync reads it only through opencode's HTTP API | `docker-compose.yml` |
| Restart request | `<config dir>/.restart` | a changing value | api writes, `opencode/run.sh` polls every second | `opencode/run.sh` |
| UI preferences | browser `localStorage` | strings / JSON | web only | `web/src/shell/prefs.ts`, `hooks/usePref.ts`, `hooks/usePaneSizes.ts`, `shell/chatAppearance.ts` |
| Server state in the browser | TanStack Query cache, in memory | n/a | web | `web/src/main.tsx` |

Notes on the table:

- opencode's UI keeps its own settings in `localStorage` of the same origin; Zync only reads and
  sets a few of them for the chat's appearance (`web/src/shell/chatAppearance.ts`). Those keys are
  opencode internals.
- `.zync/people*` and `.zync/memory` at the root are **global**; `.zync/` inside a workspace holds
  that workspace's memory, order and activity.
- A card, event, identity or routine is "a page": the same file opens in the Files editor
  (`web/src/files/CardFile.tsx`, `IdentityFile.tsx`, `MirrorFile.tsx`, `TextOrCard.tsx`) and in
  the dedicated view.

### 4.3 In-memory state that looks like storage but is not

All of this is derived or ephemeral and is lost on restart without data loss:

| What | Where | Why it is not a datastore |
| --- | --- | --- |
| Auth/connections file cache | `AuthStore.data`, `ConnectionStore.data` promises (`api/src/auth/store.ts`, `connections/store.ts`) | A read-through cache of the JSON file, loaded once; writes are serialized through a promise chain and persisted atomically. This assumes **one api process** is the only writer. |
| Sign-in rate limiter | `FailureLimiter` maps (`api/src/auth/limiter.ts`) | Lock-outs reset on restart |
| File-list cache | `listFilesCached` (`api/src/search.ts`) keyed by the watcher's change counter | Rebuilt from the disk |
| One chokidar watcher per workspace | `events.ts` | Closed when the last tab leaves |
| Scheduler's registered crons, running sessions, last-seen job mtimes | `Scheduler` maps (`jobs/src/scheduler.ts`) | Rebuilt by scanning job files; `.running/` is wiped at boot |
| Becoming daily guards | `BecomingDaily.finalizedOn/nudgedOn` (`jobs/src/becoming/daily.ts`) | Per-day flags in memory; a scheduler restart after 03:00 or 20:30 re-runs the step (finalize is idempotent by vote semantics, nudge could repeat) |
| Connections state (reconnect backoff) | `Connections.states` (`api/src/connections/service.ts`) | Ephemeral |

---

## 5. Data flow

### 5.1 Read and write path

```
 Browser (React, TanStack Query)
    |  fetch /zync/api/...  (cookie session; every request passes the guard)
    v
 api route (zod body) --> @zync/jobs function --> safeResolve(ws, rel) --> fs read/write
    ^                                                                          |
    |  JSON response (typed by hand in web/src/types)                          v
    +------------------------------------------------------------ files in /workspace
```

- Routes are deliberately thin: validate with zod (`api/src/body.ts`), call the library, return
  JSON. Rules deeper than shape (cron syntax, column ids, dates) live in `@zync/jobs` next to the
  file they describe.
- The browser's only HTTP client is `web/src/api.ts`.
- Reads parse leniently: a hand-edited file keeps whatever still parses (`parseMirror`,
  `readStored` for people, `parseIdentity`), unreadable JSONL lines are skipped.

### 5.2 Live refresh

```
 any writer: api | AI file tools | MCP | plugin | scheduler | user's editor | another tab
                              |
                        file on disk changes
                              |
        chokidar watcher (one per watched workspace, depth 12)   api/src/events.ts
                              |  SSE  GET /zync/api/ws/:ws/events  (data: {type, path}, ping every 25 s)
                              v
        EventSource in useWorkspaceEvents(ws)                    web/src/hooks/useWorkspaceEvents.ts
                              |  batch 250 ms, then invalidateQueries by path prefix
                              v
        TanStack Query refetches only mounted queries
```

The invalidation map in `useWorkspaceEvents.ts` is the de-facto "change feed schema": `.md` anywhere
invalidates boards, calendar and becoming; `.opencode/jobs/` invalidates jobs and runs; `Briefs/`,
`Training/`, `.zync/memory/`, `.zync/activity.jsonl` each have their own keys. The query client
sets `staleTime: 30_000` and `refetchOnWindowFocus: false` precisely because SSE does the
refreshing (`main.tsx`).

Things SSE does not cover are polled: jobs every 15 s (`useWorkspaceData.ts`), and global memory and
people notes (outside any workspace, so no watcher sees them) per `docs/architecture.md`.

A second, independent watcher exists in the scheduler process: `ActivityRecorder` uses Node's
`fs.watch` (not chokidar) so that activity is recorded even when no browser is open
(`jobs/src/becoming/recorder.ts`).

### 5.3 Concurrency and conflict handling

This is **narrower than "mtime-based 409 everywhere"**:

| Surface | Mechanism | Code |
| --- | --- | --- |
| opencode config and opencode library files (agents, commands, skills) | Real optimistic concurrency: client sends `x-base-mtime`, server compares to the file's current mtime (tolerance 1 ms) and answers **409 with the current `mtime`**; writes are tmp+rename | `api/src/opencode-config-routes.ts:35-45`, `opencode-library.ts:142-151`, client in `web/src/api.ts` (`saveOpencodeConfig`, `saveLibraryFile`) |
| Auth and connections files | Single process, writes serialized through a promise chain, atomic tmp+rename | `auth/store.ts`, `connections/store.ts` |
| Workspace files (`PUT /file/*`) | **Last write wins.** `express.text` body, plain `writeFile`, no base-mtime check; returns the new mtime | `api/src/fs-routes.ts:118-128` |
| Cards, events, memories, identities, routines, jobs | Read-modify-write of a whole file (`readCard` then `writeCard`). Not atomic, not compared. Name collisions are handled (`flag: 'wx'` for memories, `freeFileName` for events, `conflict()` for "already exists", "one experiment at a time", "workout in progress") | `jobs/src/boards/card-io.ts`, `memory/store.ts:47`, `calendar/events.ts` |
| Append-only logs | `appendFile` of one small JSON line, so concurrent appenders (scheduler, api) do not clobber each other | `runs.ts`, `becoming/votes.ts`, `becoming/activity.ts`, `training/body-weight.ts` |

The editor side compensates for "anyone can write":

- `useFileSnapshot` replaces the loaded file when the mtime changes on disk, **unless there are
  local edits** (`dirty`) and not for the editor's own save echoing back (`ownMtime`); it flags an
  "external" change for 4 s (`web/src/hooks/useFileSnapshot.ts`).
- `useExternalReload` remounts an uncontrolled editor only when text really changed underneath,
  never while a save is pending and never while the editor has focus (applied on blur)
  (`web/src/hooks/useExternalReload.ts`).
- `createSaver` debounces writes and keeps a failed edit pending for retry
  (`web/src/hooks/useDebouncedSave.ts`).

Consequence: two writers editing the same file at the same moment (for example the AI and the user
on the same card) can silently overwrite one another. The common cases are narrowed by the editor
logic above, not prevented by the server.

---

## 6. Domains

All domain logic is in `packages/jobs/src/<domain>/` (pure functions over a `wsPath`), exposed three
ways: api routes (`packages/api/src/*-routes.ts`), MCP tools (`packages/jobs/src/mcp/tools/*.ts`)
and, for memory/becoming/training context, the opencode plugin.

### Boards and cards
A board is a folder containing `.board.json` (`BOARD_FILE`, `boards/types.ts`); each `.md` in it is
a card; the title is the file name, a plain note dropped into the folder appears in the first
column. Files: `boards/{board-file,boards,card-file,card-io,cards,card-job,card-runs,refs}.ts`.
Routes: `api/src/boards-routes.ts`. Tools: `mcp/tools/boards.ts`. Assigning a card to `ai` with a
`runAt` (or "Run now") makes `syncCardJob` write a linked one-shot job `card-<title>-<hash>.md`
(`boards/card-job.ts`); the scheduler then updates the card at start and end (`applyCardRun`:
columns `doing`, `review`, `todo`, `ai.state`, `sessionId`, `summary`). A card edited by hand in
Files re-syncs its job on save (`syncCardFile` in `fs-routes.ts`); a card deleted by hand leaves an
orphan job that the scheduler removes at run time (`scheduler.ts` `fire`).

### Calendar
Events are `Calendar/<Title>.md` with wall-clock local times (no timezone), optional `repeat`
(`day|week|month|year`, interval, days, until, except). `calendarRange` merges events, cards (`due`,
AI `runAt`) and scheduled jobs (one-shot and each cron occurrence) into one timeline
(`calendar/{events,event-file,repeat,occurrences,range}.ts`, `api/src/calendar-routes.ts`). Google
Calendar events are fetched live from the connected accounts and never copied into the workspace
(`api/src/connections/google-calendar.ts`). UI: `web/src/calendar/` (month, time grid, timeline,
drag, side panels).

### Memory
The AI's long-term memory is markdown: global (`<root>/.zync/memory/`) and per workspace
(`<ws>/.zync/memory/`), with `type`, `description`, `pinned` frontmatter
(`memory/{store,memory-file,context,prompt,search}.ts`). Search is a scan with text matching
(`memory/search.ts`), not an index. The opencode plugin builds a `<memory>` block per request
(people notes, pinned memories in full, a one-line index of the rest) so edits apply to the next
message; the Memory page shows the exact block ("What the AI sees", `web/src/memory/PromptPreview.tsx`).
Routes: `api/src/memory-routes.ts`.

### People
`<root>/.zync/people.json` (global; `me` and `ai` are built-in, `jobs/src/people/people.ts`) plus
`people/<id>.md` notes (`people/notes.ts`). People appear as card assignees and event attendees;
`ai` is the assignee the scheduler executes.

### Jobs and the scheduler
`job-file.ts` parses and validates job markdown (zod + `croner`); the scheduler
(`jobs/src/scheduler.ts`) is a separate process with no HTTP server:

- every 5 s it lists workspaces, lists jobs, re-registers a cron only for files whose mtime changed
  (`known` map), and consumes `.trigger/` markers;
- `fire`: re-reads the job, drops orphan card jobs, records `skipped` if the previous run is still
  active, creates an opencode session in the workspace directory with the `job` agent
  (`OpencodeClient`, `jobs/src/opencode.ts`), sends the prompt (`job-prompt.ts`) with
  `prompt_async`, writes `.running/<name>.json`;
- completion comes from opencode's `/global/event` SSE (`session.idle` / `session.error`), with a
  15 s poll fallback and abort after `JOB_TIMEOUT_MIN` (default 30);
- it appends a `RunRecord` (`ok | failed | timeout | skipped`, trigger `schedule | manual`) to
  `<name>.runs.jsonl`, updates the card if any, and sends an ntfy push (`notify.ts`) linking to
  `APP_URL/w/<ws>/chat?session=<id>`;
- one-shot (`at:`) jobs set `enabled: false` after firing.

The api never calls the scheduler: "run now" is a file in `.trigger/`.

### Briefs
The daily brief is an ordinary job `daily-brief` (default `0 7 * * *`, `briefs/brief-job.ts`) whose
instructions tell the AI to read connected accounts and call `write_brief`, producing
`Briefs/<date>.md` with a checklist of suggested to-dos; the UI turns a to-do into a card with one
click (`api/src/briefs-routes.ts`, `briefs/todo-list.ts`). It needs `ZYNC_INTERNAL_TOKEN` to see
mail, chat and calendar.

### Training
A gym log as files: `Training/profile.md`, `Routines/`, `Log/` (one workout per file, weights in kg),
`Exercises/` (custom), `.body.jsonl` (`training/types.ts` header documents the layout). Stats,
personal records (e1RM), progression, volume and a "today" plan are computed on read
(`training/{stats,records,progress,progression,today,finish}.ts`). The built-in exercise catalog is
a static JSON asset (`packages/jobs/assets/exercises.json`). When a profile exists the plugin adds
a Training block to the AI's system prompt (`training/prompt.ts`). Routes:
`api/src/training-routes.ts`; tools in `mcp/tools/training.ts`; skill `opencode/skills/training`.
UI: `web/src/training/` (setup wizard, today, routines, log, progress, live workout with rest timer).

### Becoming
(New and largely uncommitted.) "Who the user is trying to become, and the proof Zync collects"
(`becoming/types.ts` header). An **identity** is a page with statement, action, an optional "small"
2-minute version, a `when` window, `signals` (what Zync can observe: `files`, `event`, `card`,
`manual`, `workout`), `guards` (time the whole app keeps free) and a `stage`
(`experiment | trying | sticking | part`; only one experiment at a time). A **vote** is one JSONL
line per (day, identity), last line wins, a user vote is never overridden by an automatic one
(`becoming/votes.ts`). **Evidence** comes from the activity log (written by the scheduler's
recorder), cards, calendar (own plus Google busy time read through the api's internal port,
`becoming/external.ts`) and finished workouts. Daily, the scheduler finalizes yesterday at 03:00
into automatic votes and nudges about unvoted manual identities at 20:30 via ntfy
(`becoming/daily.ts`, `BECOMING_NUDGE_AT`). The **Mirror** is a weekly job `mirror-weekly`
(`0 20 * * 0`, `becoming/mirror-job.ts`) in which the AI writes `Becoming/Mirror/<week>.md` from
`becoming_week` numbers. The plugin adds a Becoming block when identities exist. Routes:
`api/src/becoming-routes.ts`; tools `mcp/tools/becoming.ts`; skill `opencode/skills/becoming`; UI
`web/src/becoming/`.

### Connections
Read-only links to outside accounts: several Google accounts (Gmail + Calendar), Slack workspaces
and a Telegram account (`api/src/connections/{service,store,google-auth,gmail,google-calendar,slack,telegram,http}.ts`,
router `connections-routes.ts`). Secrets live in `connections.json` (api-only volume). The web app
reads through `/zync/api/connections/*`; the AI reads through the api's **internal** app on port
3002 (`api/src/internal.ts`), guarded by a constant-time bearer-token compare, via
`jobs/src/connections/client.ts` and the MCP tools `list_connections`, `search_mail`, `read_mail`,
`external_events`, `unread_messages`, `list_chats`, `read_chat`. There are no write tools: nothing
can send, reply or mark as read. The Google callback is the one public non-session route
(`auth/guard.ts` `PUBLIC`), protected by a one-time state issued to a signed-in session.

---

## 7. AI integration

```
 Browser ──iframe──> api :3001 ──proxy──> opencode :4096 ──> LLM providers (keys in opencode env)
                                               |  spawns
                                               +--> zync-jobs MCP (stdio)  --files--> /workspace
                                               |                           --HTTP---> api :3002
                                               +--> opencode-plugin.js     --files--> /workspace
 scheduler ──HTTP──> opencode :4096 (sessions, prompt_async, /global/event)
```

- **opencode server.** Run by `opencode/run.sh` (`opencode serve`, or `opencode web` with
  `OPENCODE_OPEN_BROWSER=1`), supervised so Settings, Restart AI server works: the app writes a new
  value into `<config dir>/.restart`, the loop notices within a second, kills opencode, re-runs
  `configure.mjs`, starts it again (opencode reads providers once per process). It also restarts it
  after a crash. Version pinned in `Dockerfile` (`OPENCODE_VERSION=2.2.5`).
- **`opencode/configure.mjs`** merges Zync's pieces into the config without clobbering user
  settings: the `zync-jobs` MCP server (local, `node dist/mcp.js`, env forwards `WORKSPACES_ROOT`,
  `TZ`, and `ZYNC_INTERNAL_TOKEN` as an `{env:…}` reference so the token is never written to the
  file), the plugin `file://…/dist/opencode-plugin.js` (replacing an older path), Zync's skills
  (copied once into `<config dir>/skills/`, tracked in `.zync-seeded`, after that the copy is the
  user's), and the `job` agent.
- **`job` agent.** `edit`, `bash`, `webfetch`, `websearch` allowed; `question`, `external_directory`
  and `doom_loop` denied (unattended). File tools cannot leave the workspace; shell commands can.
  The run prompt names the workspace and asks the AI to stay in it, which is an instruction, not a
  sandbox (`README.md`, `docs/architecture.md` security section).
- **MCP server** (`jobs/src/mcp.ts`, `mcp/tools/*`), 46 tools over the domain library:
  jobs (`list_workspaces`, `create_job`, `update_job`, `list_jobs`, `delete_job`, `run_job_now`,
  `list_runs`), people (`list_people`, `add_person`), boards (`list_boards`, `create_board`,
  `list_cards`, `create_card`, `update_card`, `run_card_now`, `delete_card`), calendar
  (`list_calendar`, `create_event`, `update_event`, `list_events`, `delete_event`), briefs
  (`write_brief`, `read_brief`), becoming (`list_identities`, `create_identity`, `update_identity`,
  `vote`, `becoming_today`, `becoming_week`, `write_mirror`), training (`search_exercises`,
  `training_profile`, `save_training_profile`, `list_routines`, `save_routine`, `delete_routine`,
  `list_workouts`, `log_workout`, `training_progress`), connections (the 7 read-only tools above).
  The MCP process writes workspace files directly through `@zync/jobs`, exactly like the api.
- **Plugin** (`jobs/src/opencode-plugin.ts`, exports only `ZyncMemory` because opencode treats every
  export as a plugin): hook `experimental.chat.system.transform` appends the memory block, the
  Becoming block (if identities exist) and the Training block (if a profile exists), and a nudge to
  save durable facts; hook `chat.message`; tools `memory_save`, `memory_read`, `memory_search`,
  `memory_delete`, `person_read`, `person_note`. Errors are returned as text so the model can
  self-correct.
- **Skills** in `opencode/skills/`: `schedule-job`, `kanban`, `calendar`, `daily-brief`,
  `training`, `becoming` (each a single `SKILL.md`). They teach the AI to ask clarifying questions
  and then write self-contained instructions. The OpenCode page in the app edits agents, commands
  and skills in the config folder (`api/src/opencode-library*.ts`, kind `agent|command|skill`, name
  `^[a-z0-9][a-z0-9-]{0,63}$`), and can compare a copy with Zync's original and reset it.
- **How the app drives opencode.** `OpencodeClient` (`jobs/src/opencode.ts`) uses opencode's HTTP
  API directly (`/session`, `/session/:id/prompt_async`, `/session/:id/abort`,
  `/session/:id/message`, `/global/event`), with optional basic auth from `OPENCODE_SERVER_PASSWORD`.
  The api also holds a client for the Becoming interview and Training generation routes
  (`becomingRoutes(opts.connections, opts.opencodeClient)`, `trainingRoutes(opts.opencodeClient)`).
- **Leak guard.** The product's opencode must never load the repo's own coding rules. In dev,
  `scripts/dev-opencode.sh` sets `OPENCODE_DISABLE_PROJECT_CONFIG=1` (the server's working directory
  is `data/workspaces` inside this repo, so it would otherwise walk up and load `AGENTS.md`,
  `CLAUDE.md`, `.opencode/`) and points `XDG_CONFIG_HOME` inside `data/` so the developer's personal
  `~/.config/opencode` is never read. Docker has no such parent folder: only `opencode/` is copied
  into the image.
- **What the AI cannot see.** `auth.json` and `connections.json` live in volumes mounted only in the
  api container, never in `/workspace`. The AI reaches connected accounts only through the api's
  internal port, and never receives a token. Caveat: what is read (mail, chat text) is sent to the
  model provider the user configured.

---

## 8. Security and auth

### Layers (outside in)

1. **No public port.** `cloudflared` dials out; `api` only `expose`s 3001 (`docker-compose.yml`).
   `api` is the only service on the `tunnel` network with `cloudflared`, so the tunnel cannot reach
   `opencode` or `scheduler` whatever route is set in the dashboard.
2. **Cloudflare Access** (email + one-time PIN, session 24 h per `docs/zero-trust-deploy.md`).
3. **The request guard** (`api/src/auth/guard.ts`), first middleware, for HTTP and WebSocket upgrades
   (`guardUpgrade`). Four checks in order: (1) `Host` equals the app's host (421; blocks DNS
   rebinding); (2) the `Cf-Access-Jwt-Assertion` token verifies against the team's JWKS, expected
   AUD, issuer, RS256, optional `CF_ACCESS_EMAIL` (403; `auth/cf-access.ts`, `jose`); (3)
   `Sec-Fetch-Site` same-origin/none and `Origin` equals the app's origin, required for unsafe
   methods and WebSockets (403; CSRF and cross-site WebSocket hijack); (4) a live session cookie,
   except a fixed `PUBLIC` allow-list (login pages, `/zync/api/auth/*` sign-in endpoints, Google's
   OAuth callback, `/zync/assets/`). Anything not listed is protected by default, so a new route
   needs no extra code to be guarded. Health is open only for `GET /zync/api/health` and answers
   `{ok:true}`.
4. **Passkeys** (WebAuthn, `@simplewebauthn/server`, `auth/webauthn.ts`, `auth/service.ts`). First
   start prints a one-time setup code (valid 1 hour) in the api log; entering it registers the first
   passkey and shows **10 recovery codes** once. Recovery codes and session tokens are stored only
   as SHA-256 hashes; passkeys as public keys. Sessions: idle 12 h, absolute 7 days, max 20,
   cookie token returned once (`auth/config.ts`, `store.ts`). **Step-up**: changing passkeys or
   recovery codes needs a passkey check within 10 minutes (`stepUpMs`). The last passkey cannot be
   removed.
5. **Rate limiting** (`auth/limiter.ts`): 5 free failures in 15 minutes, then a lock of 1 minute
   doubling to 1 hour, per address and globally (single user, so a spread-out attack is slowed the
   same way); a lockout sends an ntfy alert. `auth/alerts.ts` also alerts on new sign-in and passkey
   changes.
6. **Response hardening** (`auth/headers.ts`): `nosniff`, `X-Frame-Options: SAMEORIGIN`,
   `Referrer-Policy: no-referrer`, COOP/CORP same-origin, Permissions-Policy, HSTS on https, and a
   page CSP built at startup with a hash for the inline theme script (`script-src 'self'`, no
   `object-src`, `base-uri 'none'`, `frame-ancestors 'self'`). Raw workspace files are served with
   `nosniff` and `Content-Security-Policy: sandbox` for active content so an HTML/SVG file (even one
   written by the AI) cannot run scripts with the app's cookies (`fs-routes.ts`).
7. **Fail closed.** Missing/invalid `APP_URL` or Access settings stop the api at start; an
   unparseable `auth.json` stops the app instead of starting empty; `ZYNC_INSECURE_DEV=1` disables
   the gate, refuses to start in production and then listens on `127.0.0.1` only
   (`api/src/index.ts`).

### Internal port and token
`internalApp` (`api/src/internal.ts`) is a separate Express app on `ZYNC_INTERNAL_PORT` (3002),
enabled only when `ZYNC_INTERNAL_TOKEN` is set, with a SHA-256 + `timingSafeEqual` bearer check on
every route, read-only. It is not in the compose `expose` list and the tunnel route targets 3001.
Nuance: the process binds `0.0.0.0`, and `cloudflared` shares the `tunnel` network with `api`, so a
mistaken tunnel route to `api:3002` would be reachable at the network level; only the bearer token
would stand in the way.

### Path safety
`safeResolve(wsPath, rel)` (`jobs/src/workspaces.ts:64`) normalizes backslashes, rejects any
target outside the workspace, then `realpath`s the nearest existing ancestor to refuse symlinks that
escape (so it works for paths that do not exist yet). Domain folders go through it
(`becomingDir`, `calendarDir`, `routinesDir`…). Names are validated: workspaces by regex
(`isValidWorkspaceName`), job and skill names kebab-case, people ids `^[a-z0-9][a-z0-9-]{0,31}$`,
markdown file names by `checkMdFile` (must end `.md`, no `/`, `\`, not hidden; anything else is a
404, never resolved on disk, `helpers/files.ts`).

### Blast radius and honest limits
- The chat and every job can run any shell command on the mounted folders; in Docker that is all of
  `/workspace` plus the container (`docs/architecture.md`). The `job` agent's file confinement does
  not cover `bash`.
- `connections.json` stores provider secrets unencrypted by design (they must sign requests); the
  protection is volume isolation and 0600/0700 modes, not encryption.
- Containers run as uid 1000 (`node`); the entrypoint starts as root only to `chown` mounted folders
  and then re-executes as `node` via `gosu` (`docker/entrypoint.sh`).

---

## 9. Frontend architecture

- **Stack:** React 19 with the React Compiler (`babel-plugin-react-compiler`, target 19, in
  `vite.config.ts`), React Router 7, TanStack Query 5, Vite 7. Milkdown Crepe is the WYSIWYG markdown
  editor; CodeMirror 6 (`CodeEditor.tsx`, `LazyCodeEditor.tsx`) edits text/JSON; `yaml` handles
  frontmatter in the Properties box.
- **Routes** (`main.tsx`, `routes.tsx`): `/` Home (workspace picker), `/login`, `/w/:ws` (Layout) with
  `overview`, `files/*`, `boards`, `boards/*`, `calendar`, `becoming`, `training` (+ `routines`,
  `log`, `progress`, `library`, `setup`, `workout/:file`), `people`, `memory`, `jobs`, `opencode(/*)`,
  `settings`, and `chat`. Every view is `React.lazy` (own chunk); `workspaceViews()` is shared by
  the main page and every split pane so they always match. `vendor` chunk holds react, router and
  TanStack.
- **Shell** (`src/shell/`): `Layout` owns the workspace page, `Sidebar` + `SideTree` (file tree with
  drag order persisted to `.zync/order.json`), `TopBar`, `CommandPalette` (full-text search, `api/src/search.ts`),
  `SplitPane`/`PaneRouter`/`PaneDivider` (split panes mirrored into `?p1=&p2=`, `shell/paneUrl.ts`),
  and `ChatDock`: the opencode chat is an iframe that **is never unmounted** (one per visited
  workspace, hidden when not shown) so conversations survive navigation.
- **State:** server state only in TanStack Query (keys such as `['tree', ws, dir]`,
  `['file', ws, path]`, `['board', ws, path]`, `['jobs', ws]`, `['calendar', ws]`, `['becoming', ws]`),
  invalidated by SSE; local component state for drafts; UI preferences in `localStorage` through a
  `useSyncExternalStore` store with an in-memory fallback (`shell/prefs.ts`, `usePref`,
  `usePaneSizes`). No global state library, no Redux or Zustand.
- **Hooks** (`src/hooks/`, 60+ files, one hook per file): data hooks per domain (`useIdentities`,
  `useTrainingToday`, `useBrief`…), editor plumbing (`useFileSnapshot`, `useExternalReload`,
  `useDebouncedSave`), shell (`useHotkeys`, `usePaneSizes`, `useTheme`), time (`useNow`,
  `useInterval`). The repo rule is "Effects are for external systems only": derive in render, update
  in handlers (`AGENTS.md`, rule 5; `react/set-state-in-effect` is a lint error).
- **Components** (`src/components/`): a premium component set (Button, Field, TextInput, Select,
  DatePicker, Dialog with `useConfirm`/`useToast`, Popover, Segmented/SegButtons, Toggle, Chip,
  PersonSelect, TagInput…). Raw `<input>`, `<button>`, `<select>`, `<textarea>`, and
  `window.confirm/prompt` are banned by rule 6. Cards and memory edit in a side panel, never a modal
  (`CardPanel`, `EventPanel`, `MemoryPanel`, `IdentityPanel`, `ExercisePanel`).
- **"A card is a file" in the UI:** `CardDocument` edits a card with the same editor as Files; the
  card's frontmatter is shown as properties above the editor, so the YAML never reaches the WYSIWYG
  (`boards/CardDocument.tsx`, `files/Properties.tsx`).
- **Typing:** web domain types are hand-written in `src/types/` (no shared package with the api, no
  code generation). `api.ts` is the contract on the client side; the api's zod schemas are the
  contract on the server side.
- **Auth in the browser:** `auth/LoginPage` with `@simplewebauthn/browser`; any 401 from the api
  sends the user to sign in (page requests are redirected server-side with `?next=`).

---

## 10. Build, dev and quality tooling

| Tool | Role | Config |
| --- | --- | --- |
| pnpm 10.29 workspaces | install, `workspace:*` linking | `pnpm-workspace.yaml`, `package.json` |
| Turborepo | task graph: `build` depends on `^build`; `typecheck` and `test` depend on `^build` (so `jobs/dist` exists before `api` uses it); `dev` persistent; caches `dist/**`; passes through env such as `WORKSPACES_ROOT`, `APP_URL`, `NTFY_*` | `turbo.json` |
| TypeScript 7 | `tsc -p tsconfig.build.json` for `api` and `jobs`; `web` runs `tsc --noEmit && vite build` | `tsconfig.base.json` |
| oxlint (type-aware, via `oxlint-tsgolint`) | every rule is an error; categories `correctness`, `suspicious`, `perf`; React Compiler rules (`react/purity`, `refs`, `immutability`, `set-state-in-effect`…), a11y, vitest rules; `import/no-cycle`; disables need a `-- reason` and unused ones are errors | `oxlint.config.ts` |
| oxfmt | formatter, 120 columns, no semicolons, single quotes. **Ignores `*.md`, `*.css`, `*.json`, `*.html`, `*.yml`** | `oxfmt.config.ts` |
| knip | dead exports and files; entries include `opencode/configure.mjs`, `scheduler.ts`, `opencode-plugin.ts` | `knip.json` |
| vitest 4 | unit tests per package (81 `*.test.ts(x)` files); api tests use `supertest`; web tests use jsdom + Testing Library, `TZ=Europe/Paris` pinned for calendar math | `vitest run` per package; web config in `packages/web/vite.config.ts` |
| tsx | `api` dev server with `--env-file-if-exists=../../.env` | `packages/api/package.json` |
| GitHub Actions | `ci.yml`: format:check, lint, typecheck, test, build, knip (Node 24, frozen lockfile); plus two Claude workflows | `.github/workflows/` |

Commands (`AGENTS.md`): `pnpm check` = `format:check` + `lint` + `typecheck` + `test` + `knip` (the
bar); then `pnpm build`. `pnpm dev` runs api + scheduler (`jobs` dev = `tsc --watch` and
`node --watch dist/scheduler.js`) + Vite; `pnpm dev:opencode` runs the AI server.

Repo rules for contributors and coding agents are in `AGENTS.md` (zero-output bar, fix don't silence,
same behavior in refactors, types are the contract, premium components, a card is a file, one thing
per file, tests with the change, no commits unless asked), with eight skills under
`.opencode/skills/dev-*`.

---

## 11. Deployment

- **Image** (`Dockerfile`): multi-stage on `node:24-bookworm-slim`. `build` stage installs with the
  frozen lockfile and runs `pnpm build`; `deps` stage installs production dependencies filtered to
  `@zync/api...`; `runtime` adds `git curl ca-certificates ripgrep python3 tini gosu`, installs
  `@opencode/cli@2.2.5` globally, symlinks `xdg-open` to `/bin/true` (opencode tries to open a
  browser), copies `packages/{jobs,api,web}/dist`, the exercise catalog `packages/jobs/assets`,
  `opencode/` and the entrypoint. `ENTRYPOINT ["tini","--","/entrypoint.sh"]`, `CMD ["api"]`.
- **Entrypoint** (`docker/entrypoint.sh`): if root, `chown` entries not owned by `node` in the
  workspaces root, `/opencode-config`, `/zync-auth` and opencode's two home folders, then
  `exec gosu node`. Role dispatch: `api` runs `dist/index.js`; `scheduler` runs `dist/scheduler.js`;
  `opencode` seeds `~/.config/opencode/opencode.json` from `/app/opencode/opencode.json` on the
  first start of a fresh volume, exports `ZYNC_MCP_PATH` and `ZYNC_SKILLS_DIR`, `cd`s into the
  workspaces root and `exec`s `opencode/run.sh` on `0.0.0.0:4096`.
- **Compose** (`docker-compose.yml`): YAML anchors (`x-common`) give the three roles the same
  image (`zync:latest`), `restart: unless-stopped`, `TZ`, `WORKSPACES_ROOT`, `OPENCODE_URL`
  (`http://opencode:4096`) and the workspaces bind mount. Required variables fail fast:
  `WORKSPACES_HOST_DIR`, `APP_URL`, `CLOUDFLARE_TUNNEL_TOKEN`. Named volumes: `zync-auth`,
  `zync-connections`, `opencode-config`, `opencode-data`. Networks: implicit `default`, plus
  `tunnel` (not `internal`, since cloudflared needs the internet and the api fetches Access signing
  keys).
- **Dokploy**: Compose-type app from this git repo; no Dokploy domain (the tunnel replaces it);
  environment from `.env.example`; Cloudflare tunnel route `zync.<domain>` to `http://api:3001`
  (HTTP Host header must equal the app's host, else the guard answers 421), Access application with
  an email policy (`docs/zero-trust-deploy.md`, steps 1 to 9, including the recovery path "delete
  `auth.json` in the `zync-auth` volume").
- **Notifications**: ntfy (`NTFY_URL`, `NTFY_TOPIC`, `NTFY_TOKEN`), used by the scheduler (job
  results, Becoming nudge) and by the api (sign-in alerts). No topic means off.
- **Backups**: the workspaces folder (git or `cp -r`) holds all user data; add `zync-auth` and
  `zync-connections` (secrets) and `opencode-config` / `opencode-data` (AI config, chat history,
  provider logins) for a complete restore.

---

## 12. Files vs a database: trade-offs and recommendations

### What file-based storage buys

| Benefit | In this codebase |
| --- | --- |
| Single source of truth shared with the AI | opencode edits the same markdown with ordinary file tools; the MCP server and plugin use the same library as the api |
| Live sync with no protocol | One watcher plus SSE covers every writer (`events.ts`) |
| Zero operational surface | No DB container, no migrations, no connection pool, no backup job; `cp -r`/git is the backup and history (diffs are readable) |
| User ownership and escape hatch | Plain files survive Zync; hand edits are first-class and tolerated (lenient parsing, unknown frontmatter keys preserved in `extra`) |
| Service decoupling | Scheduler, api and opencode only share a folder; "run now" is a marker file |
| Simple security story | Secrets are in separate volumes the AI cannot mount; everything else is meant to be readable by the AI |

### What it costs

| Cost | Where it shows |
| --- | --- |
| No transactions or cross-file consistency | Card move plus job sync, rename plus link updates are sequences of file writes (`card-job.ts`, `cards.ts` rename); a crash or concurrent writer mid-way leaves a half-applied state (the scheduler's orphan-job cleanup is the repair mechanism) |
| Last-write-wins on workspace files | `PUT /file/*` and card patches have no version check (section 5.3); only opencode config files have 409s |
| Non-atomic writes | About 20 `writeFile` call sites write in place; a reader (or the scheduler) can see a truncated file. Atomic tmp+rename is used only for auth, connections and opencode config |
| No indexes, every query is a scan | `listCards`, `listEvents`, `listIdentities`, `listMemories` read the whole folder; calendar range merges events + all cards + all jobs on each request; `readVotes`/`readActivity` re-read and re-parse the entire JSONL on each call (the run log is the exception: `readRuns` reads backwards in 64 KiB chunks) |
| Search is bounded brute force | `search.ts` caps at 5000 files, depth 8, and 1 MB searched per file; cached by watcher version only while a browser is watching |
| Whole-workspace watching | chokidar at depth 12 per workspace; recursive watches on a large tree cost inotify handles and CPU, and `.git`, `node_modules`, `.turbo`, `dist` are ignored by a regex |
| Unbounded append-only logs | `activity.jsonl`, `.votes.jsonl`, `.body.jsonl`, `*.runs.jsonl` have no rotation or compaction |
| Single-process assumptions | `AuthStore`/`ConnectionStore` cache in memory and assume one writer; the limiter and cache are per-process |
| Typed contract is manual | zod on disk and in request bodies, but the web's types are hand-copied |
| Multi-writer needs discipline | Four process types write the same tree (api, MCP, plugin, scheduler) |

### When a database would become worth it

Add one only when a concrete pressure appears; none is present for a single-user personal workspace:

1. **Search at scale.** If a workspace grows well beyond a few thousand files or search needs ranking,
   fuzzy matching or semantic/embedding recall over memory. Before a general DB, use a **derived,
   disposable index** (SQLite FTS5 or a small inverted index) rebuilt from the files and kept fresh
   by the existing watcher events. Files stay the truth.
2. **Query shapes the folder cannot answer cheaply.** Cross-workspace dashboards, "all cards due this
   month across boards", analytics over years of votes, workouts or activity. The Overview and
   Becoming screens already recompute from many files on each refresh; if that becomes slow, cache or
   materialize rather than migrate.
3. **Multi-user or collaboration.** More than one concurrent human, per-user permissions, audit
   trails, or realtime co-editing would need locking/versioning (server-side base-version checks at
   minimum, CRDT or OT for documents) and a real user model. `auth.json` is explicitly "the one
   user's" store.
4. **Multiple api instances (horizontal scale).** The in-memory stores and per-process limiter
   break; that requires a shared store for sessions and rate limits.
5. **Transactional integrity requirements.** If card/job linkage or training records must never be
   half-written, you need either a DB or a write-ahead pattern.
6. **Retention.** Very long JSONL logs (activity, votes, body weight) argue for compaction or a
   time-series table.

### Recommendations (ordered by value for effort, none require a database)

1. **Server-side optimistic concurrency for workspace files and cards.** Reuse the existing
   `x-base-mtime` pattern from `opencode-config-routes.ts` on `PUT /file/*` and the card/board
   PATCH routes, return 409 with the current mtime, and let the editors (already holding
   `loaded.mtime` and `ownMtime`) show a conflict. This closes the AI-vs-user overwrite window.
2. **Atomic writes everywhere in `@zync/jobs`.** Add one `writeFileAtomic` helper next to
   `helpers/files.ts` (`writeJson` already lives there) doing tmp+rename in the same directory, and
   use it in the ~20 `writeFile` sites. Rename is also what keeps chokidar events and the
   scheduler's mtime-based scan from observing partial content.
3. **Make the stores' single-writer assumption explicit** (a comment or a startup lock file) so an
   accidental second api replica fails loudly instead of corrupting `auth.json`.
4. **Cap the logs.** Rotate or compact `activity.jsonl` (the busiest: one line per file per minute)
   and bound the votes/body reads to a window.
5. **Keep the files as truth; if search or analytics start to hurt, add a derived SQLite index**
   (rebuildable from the files, fed by the watcher), not a primary database.
6. **Fix documentation drift** listed below so new contributors do not design against a model
   (Traefik, basic auth) that no longer exists.
7. **Backup guidance in the README** covering all five volumes/folders, since `/workspace` alone is
   not a full restore (passkeys, connections, AI config and chats live elsewhere).

---

## 13. Doc drift and things worth a look

These are observations from reading code against the prose docs; each is cited so it can be verified.

1. **`docs/architecture.md` is partly stale.** It describes Traefik with basic auth, `app.<domain>` /
   `chat.<domain>` hosts, `BASIC_AUTH_USERS`, `ALLOW_NO_AUTH`, `GET /api/...` (unprefixed) routes,
   and a modal for cards. The code now has the Cloudflare tunnel + Access + passkeys, one origin
   with opencode proxied, `/zync/api/...`, no `ALLOW_NO_AUTH` (`docs/zero-trust-deploy.md` says "no
   longer exists"), and a side panel for cards. `docs/zero-trust-deploy.md`, `README.md`,
   `docker-compose.yml` and `.opencode/knowledges/architecture.md` are current.
2. **The "mtime-based optimistic conflicts (409)" statement is true only for opencode config and
   library files**, not for workspace files or cards (section 5.3). `.opencode/knowledges/architecture.md`
   ("saves send the `mtime` they were based on where overwrites matter") is accurate in that
   qualified sense; it is easy to read it as broader than it is.
3. **`/zync-connections` is not in the entrypoint's `chown` list** (`docker/entrypoint.sh`: workspaces
   root, `/opencode-config`, `/zync-auth`, opencode's two home folders), and the Dockerfile does not
   create or own `/zync-auth` or `/zync-connections`. `ConnectionStore.persist` does `mkdir`
   followed by `chmod(dir, 0o700)` (`api/src/connections/store.ts`), which fails with `EPERM` for the
   `node` user on a root-owned named volume. Read from the code only (not run): on a fresh deploy,
   saving a connection may fail until the volume is chowned by hand. `zync-auth` is covered, which is
   probably why sign-in works.
4. **The scheduler container has no `ZYNC_INTERNAL_TOKEN` or `ZYNC_API_INTERNAL_URL`**
   (`docker-compose.yml`, `scheduler` environment). `BecomingDaily.tick` calls `externalBusy`, which
   uses `internalGet` and needs both (`jobs/src/connections/client.ts`). Without them it throws,
   `externalBusy` catches and returns `[]`, so automatic Becoming votes in Docker silently use only
   Zync's own calendar, not Google busy time. Graceful by design (`becoming/external.ts` comment),
   but probably not intended in production.
5. **`opencode/opencode.json` is only `{ "$schema": ... }`.** The compose comment says provider keys
   are "referenced as `{env:...}` from opencode/opencode.json", but no such references exist in the
   seed; providers are expected to be configured in Settings, AI server (the compose file still
   forwards `CODEX_ILIAD_API_KEY`, `SCW_*`, `ANTHROPIC_API_KEY` etc. to the opencode container).
6. **Becoming daily flags are in memory** (`becoming/daily.ts`): a scheduler restart after 20:30 can
   send the nudge twice on the same day.
7. **`docs/architecture.md` says services never call each other for state.** Mostly true for
   workspace data, but there are three HTTP couplings: scheduler/api to opencode (sessions), and
   MCP/scheduler to the api's internal port (connected accounts).

No database or database-like storage was found beyond what is listed in section 4: no SQLite file,
no IndexedDB, no key-value library, no `*.db`, `*.sqlite` or lock/queue files other than the marker
files `.trigger/*`, `.running/*.json` and `.restart` (a deliberate file-based signalling mechanism).
