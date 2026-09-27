import { describe, expect, it } from 'vitest'

import { basename, decodePath, dirname, encodePath, joinPath, stripMd } from './paths'

describe('paths', () => {
  it('splits a path into folder and name', () => {
    expect(dirname('a/b/c.md')).toBe('a/b')
    expect(dirname('c.md')).toBe('')
    expect(basename('a/b/c.md')).toBe('c.md')
  })

  it('joins onto the root without a leading slash', () => {
    expect(joinPath('', 'x.md')).toBe('x.md')
    expect(joinPath('a', 'x.md')).toBe('a/x.md')
  })

  it('strips the folder and the .md extension', () => {
    expect(stripMd('Sprint/Write the report.md')).toBe('Write the report')
  })

  it('encodes each segment and keeps the slashes', () => {
    expect(encodePath('My notes/a b#1.md')).toBe('My%20notes/a%20b%231.md')
    expect(decodePath(encodePath('My notes/a b#1.md'))).toBe('My notes/a b#1.md')
  })
})
