import { describe, expect, it } from 'vitest'

import { itemSummary } from './helpers'

describe('itemSummary', () => {
  it('reads an object item: its title first, the other fields after', () => {
    expect(itemSummary({ source: 'Gmail · work', title: 'Reply to Sara', link: 'https://x' })).toEqual({
      title: 'Reply to Sara',
      details: [
        ['source', 'Gmail · work'],
        ['link', 'https://x'],
      ],
    })
  })

  it('falls back to the first text field, and to plain values', () => {
    expect(itemSummary({ n: 2, who: 'Ana' })).toEqual({ title: 'Ana', details: [['n', '2']] })
    expect(itemSummary(['a', 'b'])).toEqual({ title: '["a","b"]', details: [] })
    expect(itemSummary(3)).toEqual({ title: '3', details: [] })
  })
})
