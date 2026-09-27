import { describe, expect, it } from 'vitest'

import { hashSecret, humanCode, normalizeCode, randomToken, sameSecret } from './crypto.js'

describe('auth crypto', () => {
  it('makes long, distinct tokens', () => {
    const a = randomToken()
    expect(a).toMatch(/^[\w-]{43}$/)
    expect(randomToken()).not.toBe(a)
  })

  it('hashes without keeping the secret', () => {
    expect(hashSecret('x')).toHaveLength(64)
    expect(hashSecret('x')).not.toContain('x')
  })

  it('compares secrets of different lengths safely', () => {
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abcd')).toBe(false)
  })

  it('makes readable codes that survive retyping', () => {
    const code = humanCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    expect(normalizeCode(code.toLowerCase().replaceAll('-', ' '))).toBe(normalizeCode(code))
    expect(normalizeCode('o1l-I')).toBe('0111')
  })
})
