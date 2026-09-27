// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSaver, useDebouncedSave } from './useDebouncedSave'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createSaver', () => {
  it('saves the last value once after the pause', async () => {
    const save = vi.fn<(v: string) => Promise<void>>(async () => {})
    const s = createSaver<string>(700)
    s.schedule('a', 'x', save)
    s.schedule('a', 'xy', save)
    expect(s.busy()).toBe(true)
    await vi.advanceTimersByTimeAsync(700)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('xy')
    expect(s.busy()).toBe(false)
  })

  it('saves a pending edit to its own document when another document is edited', async () => {
    const saveA = vi.fn<(v: string) => Promise<void>>(async () => {})
    const saveB = vi.fn<(v: string) => Promise<void>>(async () => {})
    const s = createSaver<string>(700)
    s.schedule('a', 'text a', saveA)
    s.schedule('b', 'text b', saveB)
    expect(saveA).toHaveBeenCalledWith('text a')
    await vi.advanceTimersByTimeAsync(700)
    expect(saveB).toHaveBeenCalledWith('text b')
    expect(saveA).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed edit pending and retries it on the next flush', async () => {
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const s = createSaver<string>(700)
    s.schedule('a', 'x', save)
    await s.flush()
    expect(s.busy()).toBe(true)
    await s.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('x')
    expect(s.busy()).toBe(false)
  })

  it('does not bring back a failed edit over a newer one', async () => {
    let fail: ((e: Error) => void) | undefined
    const first = new Promise<void>((_resolve, reject) => {
      fail = reject
    })
    const save = vi.fn<(v: string) => Promise<void>>().mockReturnValueOnce(first).mockResolvedValue(undefined)
    const s = createSaver<string>(700)
    s.schedule('a', 'old', save)
    const flushing = s.flush()
    s.schedule('a', 'new', save)
    fail?.(new Error('offline'))
    await flushing
    await s.flush()
    expect(save).toHaveBeenLastCalledWith('new')
  })

  it('cancel drops the pending edit', async () => {
    const save = vi.fn<(v: string) => Promise<void>>(async () => {})
    const s = createSaver<string>(700)
    s.schedule('a', 'x', save)
    s.cancel()
    await vi.advanceTimersByTimeAsync(700)
    expect(save).not.toHaveBeenCalled()
    expect(s.busy()).toBe(false)
  })
})

describe('useDebouncedSave', () => {
  it('flushes the pending edit on unmount', () => {
    const save = vi.fn<(v: string) => Promise<void>>(async () => {})
    const { result, unmount } = renderHook(() => useDebouncedSave<string>())
    act(() => result.current.schedule('a', 'x', save))
    expect(result.current.pending).toBe(true)
    unmount()
    expect(save).toHaveBeenCalledWith('x')
  })
})
