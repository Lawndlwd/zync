// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFileSnapshot } from './useFileSnapshot'

type Data = { mtime: number; content: string }
type Props = { data: Data | undefined; ownMtime: number | null; dirty: boolean }

const setup = (initial: Props) =>
  renderHook((p: Props) => useFileSnapshot(p.data, { ownMtime: p.ownMtime, dirty: p.dirty }), {
    initialProps: initial,
  })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useFileSnapshot', () => {
  it('loads the first data that arrives', () => {
    const { result, rerender } = setup({ data: undefined, ownMtime: null, dirty: false })
    expect(result.current.loaded).toBeNull()
    rerender({ data: { mtime: 1, content: 'a' }, ownMtime: null, dirty: false })
    expect(result.current.loaded?.content).toBe('a')
    expect(result.current.external).toBe(false)
  })

  it('reloads an external change and flags it for 4 seconds', () => {
    const { result, rerender } = setup({ data: { mtime: 1, content: 'a' }, ownMtime: null, dirty: false })
    rerender({ data: { mtime: 2, content: 'b' }, ownMtime: null, dirty: false })
    expect(result.current.loaded?.content).toBe('b')
    expect(result.current.external).toBe(true)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(result.current.external).toBe(false)
  })

  it('ignores our own save echoing back', () => {
    const { result, rerender } = setup({ data: { mtime: 1, content: 'a' }, ownMtime: null, dirty: false })
    rerender({ data: { mtime: 2, content: 'mine' }, ownMtime: 2, dirty: false })
    expect(result.current.loaded?.content).toBe('a')
    expect(result.current.external).toBe(false)
  })

  it('keeps local edits over a change on disk', () => {
    const { result, rerender } = setup({ data: { mtime: 1, content: 'a' }, ownMtime: null, dirty: true })
    rerender({ data: { mtime: 2, content: 'b' }, ownMtime: null, dirty: true })
    expect(result.current.loaded?.content).toBe('a')
  })

  it('clears the flag timer on unmount', () => {
    const { rerender, unmount } = setup({ data: { mtime: 1, content: 'a' }, ownMtime: null, dirty: false })
    rerender({ data: { mtime: 2, content: 'b' }, ownMtime: null, dirty: false })
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
