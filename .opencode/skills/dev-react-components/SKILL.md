---
name: dev-react-components
description: Component rules for the web app in the React Compiler era — purity, memoization, context, the shared control library, and zync's UI conventions (side panels, cards as files). Use when writing or changing React components.
---

# React components

`packages/web` compiles with the React Compiler (`babel-plugin-react-compiler`, target 19). The
Compiler memoizes components, hooks, values and callbacks for you — as long as render is pure.

## When to use

- Writing a new view or component, or changing props, context, or controls of an existing one.

## Rules

### Render is pure

✅ Render reads props, state, context and computes. Same inputs, same output.
❌ Reading/writing `ref.current`, `Date.now()`/`Math.random()` for output, mutating props or state,
`localStorage` writes, starting requests. (Lint: `react/purity`, `react/refs`, `react/immutability`.)

✅ Need "now"? `useNow(ms)`. Need something from the DOM? Measure it in a layout effect or hook.

### Let the Compiler memoize

✅ Plain functions and values in components. The Compiler caches them.
❌ New `useMemo`/`useCallback`/`memo` "for performance". Keep an existing one only when lint's
`preserve-manual-memoization` is happy with it; otherwise delete it.
✅ Inline objects/arrow props are fine (react-perf `jsx-no-new-*` rules are off on purpose).

### Components are defined at module level

❌ Declaring a component inside another component (it remounts every render). Render props and
handlers that *return JSX* are fine (`no-unstable-nested-components` with `allowAsProps`).

### Keys are identities

✅ `key={item.id}`, `key={path}`. Index keys only for fixed, positional, never-reordered cells —
with a disable comment saying so.
✅ Use `key` to reset a subtree when its identity changes (`<TextFile key={ws + path} …/>`) instead of
resetting state in effects.

### Context

✅ One provider value per concern. Keep rarely-changing actions separate from fast-changing values
when a context feeds many consumers; the Compiler memoizes the value object when its inputs don't
change. ❌ `value={{ … }}` built from values that change every render (`jsx-no-constructed-context-values`).

### Controls: premium components only

✅ Everything interactive comes from `src/components/`: `Button`/`IconButton`/`TextButton`/`ButtonLink`,
`TextInput`/`TextArea`/`TitleInput`/`Field`, `Select`, `PersonSelect`, `TagInput`, `DatePicker`,
`Toggle`/`Segmented`/`PillToggle`, `Popover`, `CodeEditor`, and `useConfirm()`/`useToast()` from
`Dialog`. Missing one? Build it there, themed, then use it.
❌ Raw `<input>`, `<button>`, `<select>`, `<textarea>`, native date inputs, `window.confirm/alert/prompt`,
plain modals.

### zync UI conventions

- Editing a card, event or memory opens a **side panel** beside the list/board (split view), never a
  modal. Esc closes it (`usePanelEscape`), ⌘↵ submits a draft.
- **A card is a file.** Render cards with `CardDocument`: title = file name, frontmatter = the
  property sheet, markdown body = the page in the same editor as Files. Never a "Description" box.
  One writer per card: the card API (it keeps the linked AI job in step).
- Pages and editors are uncontrolled (Milkdown, CodeMirror): remount with a `key` to load new
  content; don't push props into them.
- First-run guide: the "Get started" checklist (`onboarding/`, steps in `helpers/onboarding.ts`)
  ticks missions from real workspace data and spotlights controls marked `data-tour="…"`. A new
  core feature worth teaching gets a step there and a `data-tour` on its main control — keep the
  attribute when you restyle or move that control.
- Accessibility: every icon-only button has a `label`; lists use `role="listbox"/"option"` with
  `aria-selected`; keep jsx-a11y rules green.

### Files and exports

✅ Exactly one component per file, named export, named like the file. Subcomponents get their own
file (in a folder named after the parent when only it uses them). Helpers, hooks and domain types
never live in a component file — see `dev-code-structure`.
✅ Shared UI patterns exist once: a save-status label, breadcrumbs, lazy editors are components in
`src/components/`; don't re-implement them in a view.
✅ Views are lazy-loaded from `routes.tsx`; don't import a view statically from the shell.

## Common mistakes

- Copying a prop into state "to edit it" and syncing with an effect — key the editor or keep a draft
  and adjust during render.
- A `useCallback` whose deps the Compiler disagrees with — remove it.
- Building a new control inline because the shared one lacks a prop — add the prop to the shared one.

## Verify

```sh
pnpm lint && pnpm typecheck && pnpm --filter @zync/web test && pnpm --filter @zync/web build
```
Then ask the user to check the screen: no browser babysitting from the agent side unless asked.
