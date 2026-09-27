---
name: dev-lint-typecheck
description: How to get oxlint, oxfmt, tsc and knip to zero output the right way — reading the rule, fixing the cause, and the narrow cases where a disable comment is acceptable. Use when a lint, format, typecheck or knip error blocks you.
---

# Lint and typecheck

The bar is **zero output**: `pnpm check` runs `oxfmt --check`, `oxlint` (type-aware, all categories
that matter set to `error`), `tsc` in every package, vitest and `knip`. There are no warnings to
ignore; everything is an error.

## When to use

- Any failing check, or before declaring a task done.

## Workflow

1. `pnpm format` — formatting is never discussed, just applied (oxfmt: single quotes, no semicolons,
   trailing commas, width 120).
2. `pnpm lint:fix` — takes the mechanical fixes. Review the diff: an autofix can change behavior
   (e.g. `prefer-nullish-coalescing` on a `''` that meant "empty").
3. For each remaining error, read the rule id (`react(set-state-in-effect)`,
   `typescript(no-unnecessary-condition)`) and its help line. Look the rule up if unclear.
4. Fix the cause (tables below). Re-run until nothing prints.
5. `pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm build`.

## Frequent rules and the real fix

| Rule | Usually means | Fix |
|---|---|---|
| `react/set-state-in-effect` | Derived state synced in an effect | Compute in render, adjust during render, or move to the event handler (`dev-react-effects`). |
| `react/refs` | `ref.current` read/written during render | State if render needs it; `useEffectEvent` for latest callbacks. |
| `react/exhaustive-effect-dependencies` / `react-hooks/exhaustive-deps` | Deps don't match what the effect reads | Make the effect read what it depends on, or stop using an effect. |
| `react/preserve-manual-memoization` | A `useMemo`/`useCallback` the Compiler can't keep | Delete it; the Compiler memoizes. |
| `typescript/no-floating-promises` | Promise neither awaited nor handled | `await` it, or `void` it when fire-and-forget is intended. |
| `typescript/no-misused-promises` | Async function where a void callback is expected | Wrap: `onClick={() => void save()}`. |
| `typescript/strict-boolean-expressions` | Truthiness on a nullable/number | Compare explicitly (`!== undefined`, `> 0`). |
| `typescript/no-unnecessary-condition` | The types say it can't happen | Fix the type (e.g. widen input to `unknown`) or drop the branch. |
| `typescript/no-unsafe-*` | `any` flowing in | Type the source; parse with zod or narrow `unknown`. |
| `typescript/no-base-to-string` | `String(obj)` → `[object Object]` | Format explicitly (a `textOf()` helper, `JSON.stringify`). |
| `unicorn/consistent-function-scoping` | Inner function uses nothing from its scope | Move it to module level. |
| `import/no-cycle` | Two modules import each other | Move the shared piece into a lower module (a constant into its only user or `helpers.ts`; recursion via a render prop — see `dev-code-structure`). |
| `oxc/no-map-spread` | `{ ...x, y }` inside `.map` | Build the object differently, or `Object.assign` a fresh/owned object. |
| knip "unused export" | Exported but only used locally | Drop `export`. Unused file/dependency → delete it. Common right after moving code: the old re-export or a now-local constant. |
| TS "not assignable to `keyof WindowEventMap`" | A custom `zync:*` window event | Declare it in `web/src/types/events.d.ts`, then `useEventListener`. |
| TS2322 `undefined` not assignable (indexed access) | `noUncheckedIndexedAccess` | Handle the missing case (`?? fallback`, early return). |

## Disable comments

Allowed only when the rule is wrong for this line, never to save time:

```ts
// oxlint-disable-next-line react/no-array-index-key -- one cell per fixed time slot, never reordered
```

- Always `-next-line` with the exact rule id and a `-- reason`.
- Unused disable directives are errors (`reportUnusedDisableDirectives`), so stale ones surface.
- Never file-wide disables; never `@ts-ignore` / `@ts-expect-error` to pass typecheck.
- Config changes (`oxlint.config.ts`) need a comment explaining the project-wide reason.

## Common mistakes

- Casting to silence `no-unnecessary-condition` instead of fixing the type upstream.
- Adding a dependency to an effect's array to satisfy lint when the effect shouldn't exist.
- Running only `oxlint` on one file: type-aware rules and knip need the whole project.

## Verify

```sh
pnpm check && pnpm build
```
