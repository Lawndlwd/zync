---
name: dev-react-effects
description: When (not) to use useEffect in the web app, the shared hooks that replace hand-written effects, useEffectEvent, and cleanup rules. Use when adding or changing effects, refs, timers, listeners or state derived from props.
---

# React effects

An effect synchronizes a component with something **outside React** (DOM APIs, timers, sockets,
editors like CodeMirror/Milkdown). Everything else — values computed from props or state, reactions to
a click — does not belong in an effect. The React Compiler lint rules (`set-state-in-effect`,
`refs`, `exhaustive-effect-dependencies`, `purity`) enforce this.

## When to use

- You are about to write `useEffect`, `useLayoutEffect`, `useRef` for a value, `setTimeout`,
  `addEventListener`, or "sync this state when that prop changes".

## Decision table

| You want to… | Do this |
|---|---|
| Compute a value from props/state | Compute it in render (the Compiler memoizes). |
| Reset state when a prop/key changes | Key the component (`key={id}`), or adjust during render (below). |
| React to a click/keypress/submit | Do it in the event handler. |
| Focus an element when it appears | `autoFocus` on the control. |
| Listen to window/document events | `useEventListener` / `useHotkeys`. Custom events (`zync:*`): declare them in `WindowEventMap` (`src/types/events.d.ts`), then `useEventListener`. |
| Esc to close a side panel, ⌘↵ to submit | `usePanelEscape(onClose, { onSubmit })`. |
| Re-render on a clock | `useNow(ms)`; a periodic task: `useInterval(fn, ms \| null)`. |
| Debounce a value (search box) | `useDebouncedValue(value, ms)`. |
| Autosave an editor | `useDebouncedSave()` → `schedule(docKey, value, save)`. |
| Show a file, reload on external change | `useFileSnapshot(data, { ownMtime, dirty })`. |
| Remount an uncontrolled editor on external change | `useExternalReload(value, busy)`. |
| Follow a media query | `useMediaQuery(query)` — also for `prefers-color-scheme`, never a hand-written `matchMedia` listener. |
| Keep the highlighted row visible | `useScrollActiveIntoView(ref, index)`. |
| Position a floating layer | `useAnchoredPosition(ref, compute, { enabled, at })` (or `Popover`). |
| Close a popover on outside click / Esc | `useDismiss(ref, open, close, anchor)`. |
| A localStorage preference | `usePref(key, fallback)` (shared live across components). |
| Light/dark theme on `<html>` | `useTheme()` (`useMediaQuery` + one layout effect). |
| Refresh queries when files change | `useWorkspaceEvents(ws)` (SSE, once in the shell). |
| Drive CodeMirror, Milkdown, EventSource | A real effect, with cleanup. |

All hooks live in `packages/web/src/hooks/` (one per file, each with a test). The only hooks outside
are context accessors kept with their provider (`useConfirm`/`useToast` in `components/Dialog.tsx`).

## Rules

### Adjust state during render, not in an effect

✅
```tsx
const [seenFor, setSeenFor] = useState(key)
if (seenFor !== key) {
  setSeenFor(key)
  setSelected(0)
}
```
❌ `useEffect(() => setSelected(0), [key])` — renders twice, flashes stale UI.

### Latest callbacks: useEffectEvent, not refs written in render

✅
```tsx
const onChange = useEffectEvent((v: string) => props.onChange(v))
useEffect(() => {
  const view = new EditorView({ …, dispatch: () => onChange(view.state.doc.toString()) })
  return () => view.destroy()
}, [])
```
❌ `const cb = useRef(onChange); cb.current = onChange` — writing a ref during render breaks the
Compiler (`react/refs`). Copying state into a ref in a no-deps `useLayoutEffect` "every render" is
the same pattern in disguise. Handlers already see the latest props and state; read values like
`location` directly. When callbacks must compose several changes before React re-renders (the
split panes' `commit`), keep **one** ref as the source of truth and write it together with the
state at every change — never mirror state into it from an effect. Effect events may be called only from effects (and code they set up), never
from render or event handlers. For event handlers, just use the prop directly.

### Refs are for the DOM and for values render never reads

✅ `ref.current` in handlers and effects. ❌ `ref.current` in JSX or in render logic — if render
needs it, it is state.

### Every effect cleans up

✅ Timers cleared, listeners removed, observers disconnected, editors destroyed, async work guarded
with a `cancelled` flag. ❌ A `setTimeout` in a handler or effect with no way to clear it.

### Dependencies are what the effect reads

✅ The dependency list matches what the body uses — no more (lint: extra dependencies), no less.
If you want an effect to rerun "when X changes" but it doesn't read X, it probably shouldn't be an
effect. ❌ `// eslint-disable exhaustive-deps`.

### StrictMode

Effects mount, unmount and mount again in dev. Anything that attaches to the DOM (editors) must tolerate
a second instance while the first is being torn down: give each instance its own container, guard
async setup with a `cancelled` flag.

## Common mistakes

- Autosave that flushes with the *new* document's save function after a switch — `useDebouncedSave`
  carries the save per edit and flushes the old document first.
- Reloading an editor on our own save's echo — compare with `ownMtime`/last saved text.
- `useEffect(() => { if (open) inputRef.current?.focus() }, [open])` → `autoFocus`.
- Polling data that already has live file events (SSE) — see `dev-data-fetching`.
- Syncing state from the URL: the router is an external system, so an effect that reads
  `location` and calls `navigate()` is fine; plain derived state (a value computed from the URL)
  is computed in render.
- Depending on a whole object/map when the effect reads one entry — depend on the entry.

## Verify

```sh
pnpm lint && pnpm --filter @zync/web test
```
Hook changes need a `renderHook` test (see `dev-testing`).
