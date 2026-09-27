// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTheme } from './useTheme'

let osDark = false
const listeners = new Set<() => void>()

beforeEach(() => {
  osDark = false
  listeners.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: osDark,
    media: query,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const applied = () => document.documentElement.dataset.theme

describe('useTheme', () => {
  it('follows the OS when set to system', () => {
    renderHook(() => useTheme())
    expect(applied()).toBe('light')
    osDark = true
    act(() => {
      for (const cb of listeners) cb()
    })
    expect(applied()).toBe('dark')
  })

  it('applies an explicit choice whatever the OS says', () => {
    osDark = true
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current[1]('light')
    })
    expect(result.current[0]).toBe('light')
    expect(applied()).toBe('light')
  })
})
