// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useElement } from './useElement'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useElement', () => {
  it('finds an element already on the page', () => {
    document.body.innerHTML = '<button data-tour="x">X</button>'
    const { result } = renderHook(() => useElement('[data-tour="x"]'))
    expect(result.current?.textContent).toBe('X')
  })

  it('finds an element that appears later', async () => {
    const { result } = renderHook(() => useElement('[data-tour="late"]'))
    expect(result.current).toBeNull()
    act(() => {
      document.body.insertAdjacentHTML('beforeend', '<div data-tour="late">L</div>')
    })
    await waitFor(() => {
      expect(result.current?.textContent).toBe('L')
    })
  })

  it('forgets the element when the selector changes', () => {
    document.body.innerHTML = '<i data-tour="a"></i>'
    const { result, rerender } = renderHook(({ s }) => useElement(s), { initialProps: { s: '[data-tour="a"]' } })
    expect(result.current).not.toBeNull()
    rerender({ s: '[data-tour="missing"]' })
    expect(result.current).toBeNull()
  })
})
