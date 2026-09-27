import { describe, expect, it } from 'vitest'

import { errorMessage, firstLine, formatDuration, initials, plural } from './format'

describe('errorMessage', () => {
  it('reads an Error, or stringifies anything else', () => {
    expect(errorMessage(new Error('nope'))).toBe('nope')
    expect(errorMessage('plain')).toBe('plain')
  })
})

describe('formatDuration', () => {
  it.each([
    [undefined, '—'],
    [0, '—'],
    [42_000, '42s'],
    [185_000, '3m 05s'],
  ])('%s ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('firstLine', () => {
  it('skips blank lines and trims', () => {
    expect(firstLine('\n  \n  Hello  \nWorld')).toBe('Hello')
    expect(firstLine(undefined)).toBeUndefined()
  })
})

describe('plural', () => {
  it('adds an s except for one', () => {
    expect(plural(1, 'task')).toBe('1 task')
    expect(plural(3, 'task')).toBe('3 tasks')
    expect(plural(0, 'task')).toBe('0 tasks')
  })
})

describe('initials', () => {
  it('takes up to two initials', () => {
    expect(initials('ada king lovelace')).toBe('AK')
    expect(initials('  ')).toBe('?')
  })
})
