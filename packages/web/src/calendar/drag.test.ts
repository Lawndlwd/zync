// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { startDrag } from './drag'

const down = (pointerType: string) => ({ clientX: 0, clientY: 0, button: 0, pointerType, preventDefault: () => {} })
const fire = (type: string, clientX = 0, clientY = 0) =>
  window.dispatchEvent(Object.assign(new Event(type), { clientX, clientY }))

describe('startDrag', () => {
  it('drags with a mouse', () => {
    const on = { move: vi.fn<(x: number, y: number) => void>(), end: vi.fn<(moved: boolean) => void>() }
    startDrag(down('mouse'), on)
    fire('pointermove', 0, 20)
    fire('pointerup')
    expect(on.move).toHaveBeenCalledWith(0, 20)
    expect(on.end).toHaveBeenCalledWith(true)
  })

  it('treats a touch that stays put as a tap', () => {
    const on = { move: vi.fn<(x: number, y: number) => void>(), end: vi.fn<(moved: boolean) => void>() }
    startDrag(down('touch'), on)
    fire('pointerup')
    expect(on.end).toHaveBeenCalledWith(false)
  })

  it('leaves a moving touch to the page: scrolling never drags or creates anything', () => {
    const on = { move: vi.fn<(x: number, y: number) => void>(), end: vi.fn<(moved: boolean) => void>() }
    startDrag(down('touch'), on)
    fire('pointermove', 0, 20)
    fire('pointercancel')
    expect(on.move).not.toHaveBeenCalled()
    expect(on.end).not.toHaveBeenCalled()
  })
})
