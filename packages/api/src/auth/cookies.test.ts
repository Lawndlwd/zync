import { describe, expect, it } from 'vitest'

import { cookie, parseCookies } from './cookies.js'

describe('cookies', () => {
  it('parses a cookie header', () => {
    const c = parseCookies('a=1; __Host-zync-session=abc%3D; a=2; broken; bad=%E0')
    expect(c.get('a')).toBe('1')
    expect(c.get('__Host-zync-session')).toBe('abc=')
    expect(c.has('bad')).toBe(false)
    expect(parseCookies(undefined).size).toBe(0)
  })

  it('writes strict cookies', () => {
    const set = cookie('__Host-x', 'v', 60_000)
    for (const flag of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Max-Age=60']) expect(set).toContain(flag)
    expect(set).not.toContain('Domain')
  })
})
