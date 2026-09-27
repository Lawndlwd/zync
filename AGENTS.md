# Zync — rules for coding agents

These are rules for working **on this repository's code**. They are not about the product's own AI
(the opencode server zync runs for users); that one never reads this file (see "Leak guard").

## Hard rules

1. **Zero-output bar.** Before saying you're done: `pnpm check` (format:check · lint · typecheck ·
   test · knip) passes and `pnpm build` succeeds. Lint prints nothing, not "just warnings".
2. **Fix, don't silence.** No `oxlint-disable`, `@ts-expect-error`, `as unknown as`, `any` or
   non-null `!` to make a check pass. A disable is allowed only with a `-- reason` that explains why
   the rule is wrong *here*; unused disables are errors.
3. **Same behavior.** A refactor changes no user-visible behavior unless the task says so. When a
   bug fix changes behavior, say which.
4. **Types are the contract.** `type`, not `interface`. `unknown` at boundaries, narrowed with zod
   (API bodies, files, JSON) or type guards. Exhaustive `switch` on unions.
5. **Effects are for external systems only.** Derive in render, update in the event handler, reach
   for the shared hooks in `packages/web/src/hooks/`. See `dev-react-effects`.
6. **Premium components only.** No raw `<input>`, `<button>`, `<select>`, `<textarea>`,
   `window.confirm/prompt`. Use `packages/web/src/components/` (Button, Field, Select, DatePicker,
   Dialog's `useConfirm`/`useToast`…). Card and memory editing is a side panel, never a modal.
7. **A card is a file.** A board card is its `.md` file: title = file name, frontmatter = properties,
   body = the page, edited with `CardDocument`. Never a "Description" field.
8. **One thing per file.** One component or hook per file; helpers in `src/helpers/<topic>.ts`,
   web domain types in `src/types/`; the same logic never exists twice. See `dev-code-structure`.
9. **Tests with the change.** New logic gets a test next to it (`*.test.ts`), behavior-level.
10. **No commits, no pushes** unless asked. Leave the diff for review.

## Skills

Load the one that matches the file you're about to touch (`.opencode/skills/*/SKILL.md`):

| Skill | Use when |
|---|---|
| `dev-code-structure` | creating a file, adding a helper/type/hook/component, splitting a file |
| `dev-typescript` | writing or reviewing any TypeScript |
| `dev-react-effects` | adding/changing `useEffect`, refs, timers, listeners, derived state |
| `dev-react-components` | writing components, context, memoization, UI controls |
| `dev-data-fetching` | queries, mutations, cache keys, polling, the `api.ts` client |
| `dev-api-routes` | Express routes in `packages/api`, request validation, paths on disk |
| `dev-testing` | writing or fixing tests |
| `dev-lint-typecheck` | a lint or typecheck error you're not sure how to fix |

Architecture overview: `.opencode/knowledges/architecture.md`.

## Commands

```sh
pnpm check          # format:check + lint + typecheck + test + knip — the bar
pnpm format         # oxfmt, writes
pnpm lint:fix       # oxlint --fix, then fix the rest by hand
pnpm test           # vitest in every package (turbo)
pnpm build          # tsc (api, jobs) + vite (web)
pnpm dev            # api + web + scheduler; `pnpm dev:opencode` for the AI server
```

## Leak guard

`pnpm dev:opencode` runs the product's opencode server with its working directory inside this repo
(`data/workspaces`). It sets `OPENCODE_DISABLE_PROJECT_CONFIG=1` so that server never loads this
file, `CLAUDE.md` or `.opencode/`. Docker is unaffected: only `opencode/` is copied into the image.
