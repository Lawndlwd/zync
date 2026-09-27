import { describe, expect, it } from 'vitest'

import { safeName, slugify } from './names.js'

describe('slugify', () => {
  it('lowercases, strips accents and joins words with dashes', () => {
    expect(slugify('  Élodie  Martín ')).toBe('elodie-martin')
  })

  it('caps the length', () => {
    expect(slugify('a'.repeat(50), 10)).toHaveLength(10)
  })

  it('falls back when nothing is left', () => {
    expect(slugify('!!!')).toBe('x')
    expect(slugify('!!!', 40, '')).toBe('')
  })
})

describe('safeName', () => {
  it('replaces path separators and reserved characters', () => {
    expect(safeName('a/b:c?')).toBe('a-b-c-')
  })

  it('drops leading dots and trailing dots or spaces', () => {
    expect(safeName('..hidden. ')).toBe('hidden')
  })

  it('names an empty title "Untitled"', () => {
    expect(safeName('  ')).toBe('Untitled')
  })
})
