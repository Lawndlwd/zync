import { describe, expect, it } from 'vitest'

import { isFailedRun } from './runs'

describe('isFailedRun', () => {
  it.each([
    ['failed', true],
    ['timeout', true],
    ['ok', false],
    ['skipped', false],
    [undefined, false],
  ])('%s → %s', (status, failed) => {
    expect(isFailedRun(status)).toBe(failed)
  })
})
