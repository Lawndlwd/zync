---
name: dev-code-structure
description: Where code goes in this repo — one component or hook per file, helpers in helpers/, domain types in types/, no duplicated logic, how to split a big file and move code safely. Use when creating a file, adding a function/type/constant, or when a file grows a second component or a helper.
---

# Code structure

Every file does one thing, and every piece of logic exists once. A reader finds a function by its
kind (component, hook, helper, type) and its topic, without opening view files.

## When to use

- Creating a file, or adding a component, hook, helper function, type or shared constant.
- A file now holds a second component, a helper, or a hook next to a component.
- You are about to write logic that "looks like" something you've seen elsewhere.

## Where does it go?

| You're adding… | Put it in |
|---|---|
| A React component | Its own file, `PascalCase.tsx`, named like the component, named export. |
| A subcomponent only one parent uses | Its own file in the feature folder, named by role: `overview/Overview.tsx` + `overview/RunResults.tsx`, `boards/BoardView.tsx` + `boards/KColumn.tsx`. |
| A hook (`useX`) | `packages/web/src/hooks/useX.ts`, one per file, with `useX.test.ts`. Exception: a context's provider + its `useX` accessor stay together. |
| A pure function used by 2+ features | `src/helpers/<topic>.ts` (`dates`, `paths`, `format`, `math`, `runs`, `files`, `names`…), tested in `<topic>.test.ts`. |
| A pure function used by one feature | `<feature>/helpers.ts` (e.g. `calendar/helpers.ts`). |
| A domain type (web) | `packages/web/src/types/<domain>.ts` (`boards`, `calendar`, `memory`, `people`, `jobs`, `files`, `opencode`, `workspace`…). |
| A domain type (jobs) | Next to the code that owns the file format (`boards/types.ts`), re-exported from `index.ts`. |
| A component's props type | In the component's file. |
| A shared constant (`MONTHS`, `WEEKDAYS`, `SWATCHES`) | In the helpers file of its topic. |
| An API call | A typed method on `api` in `web/src/api.ts` (see `dev-data-fetching`). |
| An API request schema | `packages/api/src/body.ts`. |
| An error with a status (jobs/api) | `httpError` / `badRequest` / `notFound` / `conflict` from jobs `errors.ts`. |

Exempt: `web/src/icons.tsx` is a barrel of `stroked()` icons (one-line components built by a
factory) — add new icons there; `web/src/routes.tsx` is the route table of lazily loaded views.
Context providers keep their accessor hooks (`components/Dialog.tsx` → `useConfirm`/`useToast`,
`shell/ShellContext.ts` → `useShell`).

## Rules

### One component, one hook per file
✅ `boards/BoardView.tsx` exports `BoardView`; its `KColumn` lives in `boards/KColumn.tsx`.
❌ Two `function Foo(…) { return <…/> }` in one `.tsx`. ❌ `function useThing()` inside a view file.

### No helpers in component files
✅ Components import helpers. A module-level function in a `.tsx` that isn't the component → move it.
❌ `function plural(n) …` at the bottom of `Overview.tsx`.

### No duplicates
Before writing a helper, search for it:
```sh
grep -rn "function <name>\|const <name> =" packages/*/src/helpers packages/*/src
```
✅ Same logic twice → extract once, call from both. Near-duplicates that differ on purpose (e.g. a
date-only `due` means end of day, a date-only calendar item means start of day) get one helper with
a parameter or two clearly named helpers side by side, with a comment on the difference.
✅ api imports from `@zync/jobs` instead of copying (`errorMessage`, `httpError`, `statusOf`…).
❌ `err instanceof Error ? err.message : String(err)` inline — use `errorMessage(err)`.
❌ Bare `matter.stringify` — use `stringifyFrontmatter` (jobs `frontmatter.ts`).

### Names are unique within a folder
Two components called `Row` in `files/` can't both become `files/Row.tsx`. Name by role:
`ConfigRow`, `PropertyRow`. A component and a type shouldn't share a name either (`BoardCard`
type vs `BoardTile` component).

### Entry points stay put
jobs `dist/mcp.js`, `dist/scheduler.js`, `dist/opencode-plugin.js` are referenced by Docker,
`opencode/configure.mjs` and existing user configs. Split their logic into folders; keep the root
file as a thin entry.

## Moving code safely

1. Move the code (and its test) unchanged; only imports change. Behavior changes are a separate step.
2. Update every import (`grep -rn "from './old'"`), including tests and lazy `import()` in
   `routes.tsx`.
3. `pnpm knip` — reports exports nothing uses anymore and orphan files. Drop them.
4. `import/no-cycle` errors mean the moved piece belongs lower (helpers never import components,
   hooks, or `api.ts`).
5. `pnpm check && pnpm build`.

## Layering (imports point down)

```
views / components  →  hooks  →  api.ts  →  helpers, types
```
Helpers are pure: no React, no fetch, no storage. Storage-bound code (`localStorage` prefs) is a
hook or a small module in `shell/`, not a helper.

## Splitting a file: what bites

- **Import cycles.** A subcomponent that imports a constant back from its parent (`DONE_PREVIEW`
  from `BoardView`, `TIMES` from `DatePicker`) creates a cycle. Move the constant to the child
  (only user) or to the feature's `helpers.ts`.
- **Mutually recursive components** (a tree's folder renders nodes, a node renders a folder): pass
  the recursive part as a render prop (`<TreeNode>{(path, depth) => <TreeDir …/>}</TreeNode>`) so
  only one file imports the other.
- **Side-effect imports** (`import 'x.css'`) and their disable comments stay with the component
  that needs them — easy to drop when a file is rebuilt from its declarations.
- **Helpers never import components.** `formatDateValue` lived in `DatePicker.tsx`, so a calendar
  helper imported a component module; it now lives in `helpers/dates.ts`.
- **Names collide once files are flat**: rename by role before moving (`Row` → `ConfigRow` /
  `PropertyRow`, `Divider` → `DockDivider`, `Calendar` → `MonthCalendar`, `Shell` → `PanelShell`).
- **Word matches aren't uses.** After a scripted move, lint reports imports that were only matched
  in comments or strings (`Schedule` in a sentence) — remove them.
- A section-divider comment (`// ── … ──`) left dangling at the end of a split file: delete it.

## Common mistakes

- Keeping a "tiny" helper in the view because only one component uses it today — it still goes to
  `<feature>/helpers.ts` so it's testable and findable.
- Moving a component and leaving its lazy import pointing at the old path (`routes.tsx`).
- Creating `helpers/utils.ts` or `misc.ts` — name the file by topic.
- Re-declaring a type the web app already has in `types/` inside a component.

## Verify

```sh
pnpm check && pnpm build
```
