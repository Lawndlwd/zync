import { describe, expect, it } from 'vitest'

import { FailureLimiter } from './limiter.js'

describe('FailureLimiter', () => {
  it('locks after five failures, then doubles the wait', () => {
    let now = 0
    const l = new FailureLimiter(() => now)
    for (let i = 0; i < 4; i++) expect(l.fail(['ip'])).toBe(false)
    expect(l.retryAfter(['ip'])).toBe(0)
    expect(l.fail(['ip'])).toBe(true)
    expect(l.retryAfter(['ip'])).toBe(60_000)
    now = 60_000
    for (let i = 0; i < 5; i++) l.fail(['ip'])
    expect(l.retryAfter(['ip'])).toBe(120_000)
  })

  it('forgets old failures and is cleared by a success', () => {
    let now = 0
    const l = new FailureLimiter(() => now)
    for (let i = 0; i < 4; i++) l.fail(['ip'])
    now = 16 * 60_000
    expect(l.fail(['ip'])).toBe(false)
    l.succeed(['ip'])
    for (let i = 0; i < 4; i++) l.fail(['ip'])
    expect(l.retryAfter(['ip'])).toBe(0)
  })

  it('is locked when any of the keys is', () => {
    const l = new FailureLimiter(() => 0)
    for (let i = 0; i < 5; i++) l.fail(['global'])
    expect(l.retryAfter(['other-ip', 'global'])).toBeGreaterThan(0)
  })
})
