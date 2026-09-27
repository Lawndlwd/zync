// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from './useMediaQuery'

describe('useMediaQuery', () => {
  it('follows the media query', () => {
    let matches = false
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches,
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }))
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 820px)'))
    expect(result.current).toBe(false)
    matches = true
    act(() => {
      for (const cb of listeners) cb()
    })
    expect(result.current).toBe(true)
    unmount()
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })
})
