import { describe, expect, it } from 'vitest'

import { panesFromSearch, splitPath, withoutPanes, withPanes } from './paneUrl'

describe('panesFromSearch', () => {
  it('reads p1/p2 as full pane addresses', () => {
    expect(panesFromSearch('my ws', '?p1=boards%2FSprint%201&p2=files%2Fa.md&card=x')).toEqual([
      '/w/my%20ws/boards/Sprint 1',
      '/w/my%20ws/files/a.md',
    ])
  })

  it('drops absolute and escaping values', () => {
    expect(panesFromSearch('ws', '?p1=%2Fetc&p2=..%2Fother')).toEqual([])
  })
})

describe('withPanes', () => {
  it('writes panes of this workspace, keeps other params', () => {
    expect(withPanes('ws', '?card=a', ['/w/ws/files/a.md'])).toBe('?card=a&p1=files%2Fa.md')
  })

  it('ignores other workspaces and caps at two panes', () => {
    const out = withPanes('ws', '', ['/w/other/x', '/w/ws/a', '/w/ws/b', '/w/ws/c'])
    expect(out).toBe('?p1=a&p2=b')
  })

  it('clears panes when none are given', () => {
    expect(withPanes('ws', '?p1=a&p2=b', [])).toBe('')
  })
})

describe('withoutPanes', () => {
  it('keeps only the main view params', () => {
    expect(withoutPanes('?p1=a&card=x&p2=b')).toBe('?card=x')
    expect(withoutPanes('?p1=a')).toBe('')
  })
})

describe('splitPath', () => {
  it('splits on the first question mark', () => {
    expect(splitPath('/w/ws/boards/x?card=a?b')).toEqual({ pathname: '/w/ws/boards/x', search: '?card=a?b' })
    expect(splitPath('/w/ws')).toEqual({ pathname: '/w/ws', search: '' })
  })
})
