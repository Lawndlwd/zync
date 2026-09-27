# Zync architecture (for coding agents)

pnpm + turbo monorepo, Node 24, TypeScript 7, ESM everywhere.

## Packages

- `packages/jobs` — the domain library, no HTTP. Reads and writes the markdown files that *are* the
  data, one folder per domain with an `index.ts` barrel: `boards/` (types, card-file, board-file,
  card-io, cards, boards, card-job, card-runs, refs), `calendar/` (types, event-file, events,
  repeat, occurrences, range), `memory/` (types, memory-file, store, context, prompt, search),
  `people/` (people, notes); jobs and their run logs in `job-file.ts`, `runs.ts`, `job-prompt.ts`;
  workspaces in `workspaces.ts` (`safeResolve`). Shared pure code in `helpers/` (`dates`, `files`,
  `names`, `paths`, `json`, `async`). Entry points stay at the root because Docker and
  `opencode/configure.mjs` load their `dist/` files: `scheduler.ts`, `mcp.ts` (tools in
  `mcp/tools/*`), `opencode-plugin.ts`. Errors carry an HTTP status via `httpError` / `badRequest` /
  `notFound` / `conflict` (`errors.ts`). Frontmatter goes through `parseFrontmatter` /
  `stringifyFrontmatter` (never bare gray-matter).
- `packages/api` — Express 5. Thin routes over `@zync/jobs`, one router per area
  (`*-routes.ts`), bodies validated with zod (`body.ts`), one error handler
  (`middleware/error-handler.ts`) that maps ZodError → 400, `status` → itself, ENOENT → 404, EEXIST →
  409 (and passes a conflict's `mtime`). `spa.ts` serves the web build and hands every other path to
  the opencode proxy (the chat UI). `events.ts`: one chokidar watcher per watched workspace, streamed
  as Server-Sent Events. Request helpers in `helpers/`. `auth/`: the gate every request and
  WebSocket passes (Host, Cloudflare Access token, same-origin, passkey session), passkey sign-in
  (WebAuthn), recovery codes, sessions and security alerts; data in `ZYNC_AUTH_DIR`, outside the
  workspaces. Deployed behind a Cloudflare tunnel + Access with no public port.
- `packages/web` — React 19 + React Compiler, TanStack Query, react-router 7, Vite. `api.ts` is the
  only HTTP client. One component per file. Views under `src/<area>/` (`overview/`, `files/`,
  `boards/`, `calendar/`, `jobs/`, `memory/`, `people/`, `opencode/`, `settings/`, `home/`), each with
  its own `helpers.ts` when it needs one; shared controls in `src/components/`; every hook in
  `src/hooks/`; pure shared code in `src/helpers/` (`dates`, `paths`, `urls`, `format`, `boards`,
  `runs`, `math`, `dom`, `docLinks`, `textMatch`…); domain types in `src/types/`; the app shell
  (layout, sidebar, panes, chat dock, palette) in `src/shell/`. See `dev-code-structure`.

## Data flow

```
markdown files on disk ──► @zync/jobs (parse/validate/write) ──► api routes ──► web (TanStack Query)
        ▲                                                                        │
        └─ AI (opencode + zync MCP/plugin), scheduler, file editor ◄─────────────┘
file change ─► chokidar (api/events.ts) ─► SSE ─► hooks/useWorkspaceEvents ─► invalidateQueries
```

- Files are the source of truth; there is no database. Anything can write them (the AI, the
  scheduler, another tab), so the web app never assumes it is the only writer: editors reload on
  external change unless there are local edits (`useFileSnapshot`, `useExternalReload`), and saves
  send the `mtime` they were based on where overwrites matter (409 on conflict).
- Live refresh is SSE-driven. Poll only what has no file event: global memory and people notes
  (outside the workspace), server health.
- Workspaces are folders under `WORKSPACES_ROOT`. Paths from requests always go through
  `safeResolve` (no escaping the workspace). Names (jobs, skills) are validated kebab-case.

## Where things live

- Routes: `/w/:ws/<view>` (`web/src/routes.tsx`, lazily loaded), split panes mirror into `?p1=&p2=`.
- Job files: `<ws>/.opencode/jobs/<name>.md` + `<name>.runs.jsonl`.
- Board: a folder with `.board.json` (columns); each `.md` inside is a card.
- Product AI config: `opencode/` (seeded into the server's config dir; not this `.opencode/`).
