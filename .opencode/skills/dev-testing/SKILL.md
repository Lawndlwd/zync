---
name: dev-testing
description: How to write tests in this repo — vitest in every package, behavior over implementation, renderHook for hooks, temp-dir fixtures for files, supertest for routes, fake timers. Use when adding, fixing or reviewing tests.
---

# Testing

Vitest runs in every package (`pnpm test` via turbo). Tests sit next to the code: `foo.ts` →
`foo.test.ts`. They are the safety net for refactors, so they assert what a user or caller observes.

## When to use

- Any new logic, bug fix (write the failing test first), hook, route, or file format change.

## Rules

### Test behavior, not implementation

✅ "a pending edit is saved to its own document after a switch", "returns 400 for `../x`".
❌ Asserting internal state, call order of private helpers, or snapshotting large trees.
✅ One behavior per `it`, named as a sentence. `describe` per unit.

### Where each kind of test goes

| Code | Test with |
|---|---|
| Pure functions (`helpers/*.ts`, `<feature>/helpers.ts`, jobs `helpers/`, api `search.ts`) | Plain calls, table-style cases. |
| Web hooks (`src/hooks/*`, every hook lives there) | `renderHook` from `@testing-library/react`, `// @vitest-environment jsdom` at the top. |
| Components | Only when behavior can't be tested through a hook/helper; RTL queries by role/label. |
| `@zync/jobs` file logic | Real files in a temp dir (`mkdtemp(path.join(tmpdir(), 'zync-…'))`). |
| API routes | `supertest` against `createApp()` with a temp `WORKSPACES_ROOT` (see `app.test.ts`). |
| `api.ts` client | Stub `fetch` with `vi.stubGlobal` and real `Response` objects. |

### Environment

- Web tests default to the `node` environment; opt into jsdom per file with the comment above.
- `TZ` is pinned to `Europe/Paris` for web tests (DST edges exercised) — write dates in local time.
- `restoreMocks: true`: spies reset between tests. Still undo globals you stub (`vi.unstubAllGlobals()`).

### Time

✅ `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach`; advance with
`act(() => { vi.advanceTimersByTime(ms) })` when React state changes, `await vi.advanceTimersByTimeAsync`
when promises must settle. `vi.setSystemTime` for "now".
❌ Real `setTimeout` waits.

### Mocks

✅ Type mocks: `vi.fn<(v: string) => Promise<void>>()` (lint: `require-mock-type-parameters`).
✅ Mock at the boundary (fetch, matchMedia, the clock), not your own modules.
❌ Mocking the unit under test's collaborators to make it pass.

### Fixtures

✅ Build inputs with small helpers in the test file (`const run = (ts: string): RunRecord => …`),
defined at module level (lint: `consistent-function-scoping`).
✅ Each test creates its own temp dir; never touch `data/` or the real home dir.

### Lint applies to tests too

`no-floating-promises` (await or `void`), `valid-expect`, `no-identical-title`, `no-focused-tests`
(`it.only` fails CI), `expect-expect`. Unsafe-any rules are relaxed in tests, nothing else.

## Common mistakes

- Forgetting `act` around timer advances that update state → "not wrapped in act" warnings.
- Asserting on `toHaveBeenCalled` without checking arguments.
- A test that passes before the fix — make sure it fails on the old code.

## Verify

```sh
pnpm test                       # everything
pnpm --filter @zync/web test    # one package
npx vitest run src/hooks        # from a package dir, one folder
```
