import { describe, expect, it, vi } from 'vitest'

import { menuAnchor } from './dom'

describe('menuAnchor', () => {
  it('keeps a menu opened from a control on screen', () => {
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 800 })
    expect(menuAnchor({ left: 340, right: 380, bottom: 100 })).toEqual({ x: 160, y: 100 })
    expect(menuAnchor({ left: 340, right: 380, bottom: 780 })).toEqual({ x: 160, y: 460 })
    expect(menuAnchor({ left: 60, right: 100, bottom: 100 })).toEqual({ x: 8, y: 100 })
    vi.unstubAllGlobals()
  })
})
