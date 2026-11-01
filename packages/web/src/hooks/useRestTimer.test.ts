// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRestTimer } from './useRestTimer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T10:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useRestTimer', () => {
  it('counts down from the rest length and stops by itself at zero', () => {
    const { result } = renderHook(() => useRestTimer())
    expect(result.current.running).toBe(false)
    act(() => result.current.start(90))
    expect(result.current.left).toBe(90)
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current.left).toBe(60)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.running).toBe(false)
    expect(result.current.left).toBe(0)
  })

  it('adds time to the running rest, and skipping ends it', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    act(() => result.current.add(15))
    expect(result.current.left).toBe(55)
    expect(result.current.total).toBe(75)
    act(() => result.current.skip())
    expect(result.current.running).toBe(false)
  })

  it('follows the clock, not the ticks, after the tab slept', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(90))
    // The clock jumps without intervals firing in between (a sleeping tab), then one tick lands.
    vi.setSystemTime(new Date('2026-09-29T10:01:00'))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.left).toBe(30)
  })
})
