---
name: dev-data-fetching
description: How the web app talks to the API — the api.ts client, ApiError, TanStack Query keys and defaults, SSE invalidation instead of polling, cancellation, optimistic updates. Use when adding queries, mutations, API calls, or polling.
---

# Data fetching

Server state lives in TanStack Query. The files on disk are the source of truth and change under us
(the AI, the scheduler, other tabs); the app stays fresh through **live file events**, not polling.

## When to use

- Adding an endpoint call, a `useQuery`/`useQueries`, a mutation, an optimistic update, or a
  `refetchInterval`.

## Rules

### One client: `api.ts`

✅ Every request goes through `api.*` in `packages/web/src/api.ts`, built on `req<T>()` with a
precise return type. New endpoint → new typed method; paths are encoded (`enc()` for workspace
paths, `encodeURIComponent` for query values).
✅ Failures throw `ApiError` (`status`, server `message`, parsed `body` — e.g. a 409 with the current
`mtime`). Branch on `err instanceof ApiError && err.status === 409`, not on message text.
❌ `fetch` in a component; `req()` without a type argument; string-concatenated unencoded input.

### Query defaults (`main.tsx`)

- `staleTime: 30_000` — cached data is reused for 30 s; live events invalidate what changed.
- `retry`: one retry for network errors and 5xx; none for 4xx.
- `refetchOnWindowFocus: false`.
Override per query only with a reason (e.g. `staleTime: Infinity` for config you load once).

### Keys

✅ `[area, ws, …specifics]`: `['file', ws, path]`, `['tree', ws, dir, hidden]`, `['board', ws, boardPath]`,
`['calendar', ws, from, to]`, `['jobs', ws]`, `['runs', ws, job]`. Same data → same key everywhere, so
one invalidation reaches every view. Global (not per workspace): `['people']`, `['config']`,
`['memory', 'global']`, `['person-notes', id]`.
❌ Two spellings of the same resource; volatile values in keys that aren't request inputs.

### Live refresh over polling

`useWorkspaceEvents` (`hooks/`) subscribes to `/events` (SSE; chokidar on the workspace) and invalidates
by path: `file`/`tree` for the path and its folder, `board`/`boards` for `.md`/`.board.json`,
`calendar` for `.md` and jobs, `jobs`/`runs` for `.opencode/jobs/`, `memory` for `.zync/memory/`,
`recent` for visible files.

✅ New data derived from workspace files → add its key to that invalidation, no `refetchInterval`.
✅ Poll only what has no file event: global memory and people notes (outside the workspace),
server health, the chat session tracker. Pause polling when hidden (`useInterval(fn, null)`).
❌ `refetchInterval` on boards, files, calendar or anything inside the workspace.

### Cancellation

✅ Pass TanStack's `signal` through for requests that can be superseded (search as you type, paging a
calendar range): `queryFn: ({ signal }) => api.search(ws, q, signal)`.

### Writes

✅ After a mutation, `await qc.invalidateQueries({ queryKey: [...] })` for what it changed (SSE will
also arrive; invalidating keeps the UI snappy).
✅ Optimistic updates: `setQueryData` with a pure helper (see `helpers/boards.ts` `applyLocal`), roll
back on error, then invalidate.
✅ Saves that must not clobber another writer send the base `mtime` and handle 409 (reload or ask
with `useConfirm`).
✅ Debounced editor saves use `useDebouncedSave` (see `dev-react-effects`).

## Common mistakes

- `enabled` missing on a query whose inputs may be empty (`enabled: !!ws`).
- Reading `data` without handling `error` and loading (show the skeleton/`lede danger-t` like other views).
- Forgetting that `useQueries` returns a new array each render — derive from it in render, don't
  store it in state.

## Verify

```sh
pnpm --filter @zync/web test && pnpm lint
```
Test pure helpers (key builders, optimistic reducers) directly; `api.test.ts` shows how to stub `fetch`.
