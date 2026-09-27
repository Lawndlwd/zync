// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useHotkeys } from './useHotkeys'
import { usePanelEscape } from './usePanelEscape'

describe('useHotkeys', () => {
  it('calls the latest handler without resubscribing', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const first = vi.fn<(e: KeyboardEvent) => void>()
    const second = vi.fn<(e: KeyboardEvent) => void>()
    const { rerender } = renderHook(({ fn }) => useHotkeys(fn), { initialProps: { fn: first } })
    rerender({ fn: second })
    fireEvent.keyDown(window, { key: 'k' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1)
  })

  it('stops listening on unmount', () => {
    const fn = vi.fn<(e: KeyboardEvent) => void>()
    const { unmount } = renderHook(() => useHotkeys(fn))
    unmount()
    fireEvent.keyDown(window, { key: 'k' })
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('usePanelEscape', () => {
  it('closes on Esc, submits on ⌘↵', () => {
    const onClose = vi.fn<() => void>()
    const onSubmit = vi.fn<() => void>()
    renderHook(() => usePanelEscape(onClose, { onSubmit }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('leaves Esc to an open floating layer', () => {
    const onClose = vi.fn<() => void>()
    const layer = document.createElement('div')
    layer.className = 'floating'
    document.body.append(layer)
    renderHook(() => usePanelEscape(onClose))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    layer.remove()
  })
})
