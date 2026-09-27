// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useExternalReload } from './useExternalReload'

type Props = { value: string; busy: boolean }

const setup = (initial: Props) =>
  renderHook((p: Props) => useExternalReload(p.value, () => p.busy), { initialProps: initial })

describe('useExternalReload', () => {
  it('bumps the version when the text changed underneath', () => {
    const { result, rerender } = setup({ value: 'a', busy: false })
    rerender({ value: 'b', busy: false })
    expect(result.current.version).toBe(1)
  })

  it('ignores our own edit echoing back (modulo whitespace)', () => {
    const { result, rerender } = setup({ value: 'a', busy: false })
    result.current.edited('mine ')
    rerender({ value: 'mine', busy: false })
    expect(result.current.version).toBe(0)
  })

  it('waits while edits are pending or saving', () => {
    const { result, rerender } = setup({ value: 'a', busy: false })
    rerender({ value: 'b', busy: true })
    expect(result.current.version).toBe(0)
  })
})
