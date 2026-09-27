// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedValue } from './useDebouncedValue'
import { useInterval } from './useInterval'
import { useNow } from './useNow'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useInterval', () => {
  it('ticks with the latest callback and pauses on null', () => {
    const a = vi.fn<() => void>()
    const b = vi.fn<() => void>()
    const initialProps: { fn: () => void; ms: number | null } = { fn: a, ms: 1000 }
    const { rerender } = renderHook(({ fn, ms }) => useInterval(fn, ms), { initialProps })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    rerender({ fn: b, ms: 1000 })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    rerender({ fn: b, ms: null })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('useNow', () => {
  it('advances every period', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00'))
    const { result } = renderHook(() => useNow(30_000))
    expect(result.current.getMinutes()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.getMinutes()).toBe(1)
  })
})

describe('useDebouncedValue', () => {
  it('settles after the pause', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 180), { initialProps: { v: '' } })
    rerender({ v: 'a' })
    rerender({ v: 'ab' })
    expect(result.current).toBe('')
    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(result.current).toBe('ab')
  })
})
