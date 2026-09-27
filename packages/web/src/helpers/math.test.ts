import { describe, expect, it } from 'vitest'

import { clamp } from './math'

describe('clamp', () => {
  it('keeps a value within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('lets min win when the range is empty', () => {
    expect(clamp(5, 8, 4)).toBe(8)
  })
})
