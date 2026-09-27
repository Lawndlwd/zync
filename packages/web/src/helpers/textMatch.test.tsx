import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { highlight, matchesAll, queryWords } from './textMatch'

const html = (text: string, words: string[]) => renderToStaticMarkup(<>{highlight(text, words)}</>)

describe('queryWords', () => {
  it('folds case and accents, splits on non-letters and dedupes', () => {
    expect(queryWords('Café  café, RÉSUMÉ!')).toEqual(['cafe', 'resume'])
  })

  it('returns nothing for punctuation only', () => {
    expect(queryWords(' -- ')).toEqual([])
  })
})

describe('matchesAll', () => {
  it('needs every word, anywhere, accent-insensitive', () => {
    expect(matchesAll('Réunion équipe lundi', ['reunion', 'lun'])).toBe(true)
    expect(matchesAll('Réunion équipe lundi', ['reunion', 'mardi'])).toBe(false)
  })
})

describe('highlight', () => {
  it('returns the text unchanged without words', () => {
    expect(highlight('plain', [])).toBe('plain')
  })

  it('bolds matches on the original (accented) characters', () => {
    expect(html('Le café noir', ['cafe'])).toBe('Le <b>café</b> noir')
  })

  it('merges overlapping words into one run', () => {
    expect(html('weekly report', ['week', 'weekly'])).toBe('<b>weekly</b> report')
  })
})
