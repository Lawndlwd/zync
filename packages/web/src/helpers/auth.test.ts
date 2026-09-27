import { describe, expect, it } from 'vitest'

import { deviceName, isStepUp, passkeyError, safeNext } from './auth'

describe('safeNext', () => {
  it.each([
    ['/w/notes/files?x=1#h', '/w/notes/files?x=1#h'],
    [null, '/'],
    ['https://evil.test/w', '/'],
    ['//evil.test/w', '/'],
    ['/\\evil.test', '/'],
    ['javascript:alert(1)', '/'],
    ['/login?next=/x', '/'],
  ])('%s → %s', (next, to) => {
    expect(safeNext(next)).toBe(to)
  })
})

describe('isStepUp', () => {
  it('reads the server flag', () => {
    expect(isStepUp({ error: 'x', stepUp: true })).toBe(true)
    expect(isStepUp({ error: 'x' })).toBe(false)
    expect(isStepUp(null)).toBe(false)
  })
})

describe('passkeyError', () => {
  it('explains a cancelled prompt', () => {
    expect(passkeyError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toMatch(/Cancelled/)
    expect(passkeyError(new Error('boom'))).toBe('boom')
  })
})

describe('deviceName', () => {
  it('names common browsers', () => {
    expect(
      deviceName(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS')
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toBe(
      'Safari on iOS',
    )
    expect(deviceName('curl/8')).toBe('Browser')
  })
})
