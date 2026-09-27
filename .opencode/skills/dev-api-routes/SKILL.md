---
name: dev-api-routes
description: Express 5 route rules for packages/api — async handlers, zod body validation, safe paths inside workspaces, error mapping, keeping logic in @zync/jobs. Use when adding or changing API endpoints or anything that touches paths on disk.
---

# API routes

`packages/api` is a thin HTTP layer over `@zync/jobs`. Routes parse input, call the domain library,
and shape the response. File formats and business rules live in `@zync/jobs`.

## When to use

- Adding/changing an endpoint in `packages/api/src/*-routes.ts`, the proxy, SSE, or anything that
  builds a filesystem path from request input.

## Rules

### Handlers

✅ `async` handlers; Express 5 forwards rejections to the error handler — no try/catch just to
`next(err)`.
✅ Workspace routes start with `const ws = await wsOf(req)` (validates the workspace name).
✅ Status codes: `201` + body on create, `204` on delete/no content, `202` for queued work.
❌ Business logic in routes (parsing frontmatter, computing schedules) — put it in `@zync/jobs` and
test it there.

### Validate input with zod

✅ Every JSON body has a schema in `api/src/body.ts`, parsed first thing:
`const body = JobPatchBody.parse(req.body)`. ZodError → 400 with the issues (central handler).
✅ Query strings: check `typeof req.query.x === 'string'` and clamp numbers
(`Math.min(Math.max(Number(q) || 10, 1), 100)`).
❌ `req.body.x as string`, hand-rolled coercion, trusting `req.params` for paths.

### Paths on disk

✅ Any path from a request goes through `safeResolve(ws.path, rel)` (jobs `workspaces.ts`): it rejects
`..`, absolute paths and symlink escapes.
✅ Names that become file names (jobs, skills, people ids) are validated against their kebab-case
pattern before use (`checkName`, `isValidWorkspaceName`) → 400.
❌ `path.join(ws.path, req.params.name)` without validation — that is a path traversal.
✅ Serving user files raw: images/PDF as-is; everything else gets `Content-Security-Policy: sandbox`
so HTML/SVG can't script the app's origin.

### Errors

✅ Throw; don't answer errors inline. Use `httpError(status, msg)` / `badRequest` / `notFound` /
`conflict` from `@zync/jobs` (api imports them — never a local copy);
the handler in `middleware/error-handler.ts` maps ZodError → 400, `err.status` → itself, ENOENT → 404, EEXIST → 409,
anything else → 500 (logged). Body is always `{ error: string }` (plus fields a client needs, e.g.
409 conflicts carry the current `mtime`).
❌ `res.status(500).json(...)` in routes; leaking stack traces.

### Concurrency and performance

✅ Independent I/O in parallel (`Promise.all` over stats, jobs, run logs).
✅ Read only what you need: `readRuns` reads the log from the end; `listFilesCached` reuses the file
list while the workspace's watcher reports no change (`watchVersion`).
✅ Frontmatter through `parseFrontmatter` / `stringifyFrontmatter` (jobs `frontmatter.ts`; gray-matter
without options caches every input forever). No bare `matter()` / `matter.stringify`.
✅ File helpers (`exists`, `freeFileName`, `listMdFiles`, `readJson`/`writeJson`, `sleep`) come from
jobs `helpers/`; request helpers (`relPath`, `isBinary`) from api `helpers/`.
❌ Walking the workspace per request when a cached listing will do; sequential `await` in loops over
independent items.

### Auth: every route is private by default

✅ Every request (HTTP and WebSocket) passes `auth/guard.ts` first: exact Host, Cloudflare Access
token (when configured), same-origin only, then a session. A new route is protected without doing
anything — don't add auth checks to routes, and don't bypass the guard.
✅ Something must work without a session? Add its exact path to `PUBLIC` in `guard.ts`, with a
test in `auth/auth.test.ts` proving it leaks nothing. Today: the sign-in page and its API only.
✅ Sensitive account changes call `needRecent()` (a passkey check in the last 10 minutes).
✅ Secrets are never stored or logged in clear: tokens and codes as SHA-256, passkeys as public
keys, in `ZYNC_AUTH_DIR` (a volume the AI can't read — never under `WORKSPACES_ROOT`).
❌ Reading identity from headers other than the verified Access token and the session cookie;
trusting `X-Forwarded-*`; `SameSite=Lax`/non-`__Host-` cookies; `ALLOW_NO_AUTH`-style switches
(the only one is `ZYNC_INSECURE_DEV`, refused in production and bound to 127.0.0.1).

### Conflicts

✅ Writes that can race another writer accept the base `mtime` and answer 409 when the file moved on.

## Common mistakes

- Forgetting `express.json()` on a route that reads a body (the body is then `undefined`).
- Mutating cached objects (the file-list cache is shared) — copy before changing anything that isn't
  idempotent.
- A new route without a supertest case in `app.test.ts` for its happy path and its 400/404.

## Verify

```sh
pnpm --filter @zync/api test && pnpm --filter @zync/jobs test && pnpm lint && pnpm typecheck
```
