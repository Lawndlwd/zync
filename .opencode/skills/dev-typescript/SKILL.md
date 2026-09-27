---
name: dev-typescript
description: TypeScript rules for this repo (types, unknown, narrowing, errors, exhaustiveness, zod at boundaries). Use when writing or reviewing any .ts/.tsx file.
---

# TypeScript

The compiler runs with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax` and type-aware oxlint. The goal is that a passing typecheck means something:
never trade a real type for a cast to get there.

## When to use

- Adding or changing any TypeScript in `packages/*`.
- Reviewing a diff that adds `as`, `any`, `!`, `interface`, or a `catch`.

## Rules

### Declarations

✅ `type Card = { title: string; labels: string[] }`
❌ `interface Card { … }` — the lint rule is `consistent-type-definitions: type`.

✅ `import type { Board } from './api'` / `import { api, type Board } from './api'`
❌ importing a type as a value (breaks under `verbatimModuleSyntax`).

✅ Optional means "may be absent": `due?: string`. If you need to pass `undefined` explicitly, say so:
`due?: string | undefined` (required by `exactOptionalPropertyTypes`).

### unknown, not any

✅ Data from outside (request bodies, JSON files, frontmatter, `JSON.parse`, `catch`) is `unknown`
and is narrowed before use — with zod where a schema exists, with a type guard otherwise.

```ts
const body: unknown = await res.json().catch(() => ({}))
const msg = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
  ? body.error
  : undefined
```

❌ `any`, `as any`, `Record<string, any>`, `as unknown as T` (double casts hide real mismatches).

### Casts

✅ No `as`, except DOM (`e.target as HTMLElement` when the event type can't say it) and `as const`.
✅ Prefer making the type true: a type guard, `satisfies`, a generic parameter
(`Object.entries<unknown>(patch)`), or a narrower function signature.
❌ `!` non-null assertions. With `noUncheckedIndexedAccess`, `arr[i]` is `T | undefined`: use
`.at()`, `?? fallback`, destructuring with defaults, or check it.

### Errors

✅ `catch (err)` — the variable is `unknown`. Read it with `errorMessage(err)` (jobs `errors.ts` in
jobs/api, `helpers/format.ts` in web). Never inline `err instanceof Error ? … : String(err)`.
✅ Throw `Error`s — in jobs/api use `httpError(status, msg)`, `badRequest`, `notFound`, `conflict`
so the API answers with that status. ❌ `Object.assign(new Error(…), { status })` by hand. In the
web app, API failures are `ApiError` with `status` and `body`.
❌ `throw 'string'`, `(e as Error).message`, empty `catch {}` without a comment saying why it is safe.

### Unions and exhaustiveness

✅ Model states as unions (`'saved' | 'dirty' | 'saving' | 'error'`) and `switch` over them; the
`switch-exhaustiveness-check` rule makes a new member a compile error at every switch.
❌ Boolean flags that can contradict each other (`isSaving && isSaved`).

### Conditions

✅ Explicit checks: `if (list.length > 0)`, `if (value !== undefined)`, `?? default`, `?.`.
❌ Relying on truthiness of numbers/objects where `0` or `''` is valid (`strict-boolean-expressions`).
❌ Conditions the types say are always true/false (`no-unnecessary-condition`) — fix the type or
remove the branch.

### Boundaries

✅ Validate at the edge, once: API bodies with the zod schemas in `api/src/body.ts`; file contents in
`@zync/jobs` next to the code that owns the format. Inside, trust the types.
❌ Re-checking the same shape in every function; coercing `req.body` by hand.

### Modules

✅ `node:` prefix for built-ins (`import path from 'node:path'`). No import cycles (`import/no-cycle`):
if two modules need each other, move the shared piece down.
✅ Export only what another module uses (knip reports the rest).
✅ Types, helpers and components each have their home (`dev-code-structure`); web domain types live
in `src/types/<domain>.ts`, not in `api.ts` or a view.

## Common mistakes

- Widening a union to silence an error (`string` instead of `'rail' | 'split'`).
- `Object.keys(obj) as (keyof T)[]` — iterate `Object.entries` and narrow the value instead.
- Spreading in `.map` to add a field (`oxc/no-map-spread`) — build the object once, or mutate a
  fresh copy.
- `array.sort()` in place on shared data — use `toSorted()` / `toReversed()`.

## Verify

```sh
pnpm typecheck && pnpm lint
```
Both print nothing on success.
