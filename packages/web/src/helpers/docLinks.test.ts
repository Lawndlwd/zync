import { describe, expect, it } from 'vitest'

import { pageTitle, relativeLink, resolveLink } from './docLinks'

describe('relativeLink', () => {
  it('links to a sibling by name', () => {
    expect(relativeLink('notes', 'notes/a.md')).toBe('a.md')
  })

  it('climbs out of the current folder', () => {
    expect(relativeLink('notes/daily', 'plans/q3.md')).toBe('../../plans/q3.md')
  })

  it('links from the workspace root', () => {
    expect(relativeLink('', 'plans/q3.md')).toBe('plans/q3.md')
  })

  it('encodes each segment but keeps the slashes', () => {
    expect(relativeLink('', 'my plans/Q3 #1.md')).toBe('my%20plans/Q3%20%231.md')
  })
})

describe('resolveLink', () => {
  it('resolves relative to the document folder', () => {
    expect(resolveLink('notes/daily', '../../plans/q3.md')).toBe('plans/q3.md')
  })

  it('treats a leading slash as the workspace root', () => {
    expect(resolveLink('notes', '/plans/q3.md')).toBe('plans/q3.md')
  })

  it('decodes and drops the query and hash', () => {
    expect(resolveLink('', 'my%20plans/a.md?x=1#top')).toBe('my plans/a.md')
  })

  it('keeps an undecodable path as written', () => {
    expect(resolveLink('', 'bad%zz.md')).toBe('bad%zz.md')
  })

  it('refuses links that leave the workspace', () => {
    expect(resolveLink('notes', '../../etc/passwd')).toBeNull()
  })

  it('ignores external links and anchors', () => {
    expect(resolveLink('', 'https://example.com')).toBeNull()
    expect(resolveLink('', 'mailto:a@b.c')).toBeNull()
    expect(resolveLink('', '//cdn.example.com/x')).toBeNull()
    expect(resolveLink('', '#section')).toBeNull()
    expect(resolveLink('', '')).toBeNull()
  })

  it('round-trips with relativeLink', () => {
    const from = 'a/b'
    const target = 'c/d e/f.md'
    expect(resolveLink(from, relativeLink(from, target))).toBe(target)
  })
})

describe('pageTitle', () => {
  it('strips the markdown extension only', () => {
    expect(pageTitle('Plan.MD')).toBe('Plan')
    expect(pageTitle('data.json')).toBe('data.json')
  })
})
