import { describe, expect, it } from 'vitest'

import { briefFile, cardUrl } from './briefs'

describe('briefs helpers', () => {
  it('opens a card file on its board', () => {
    expect(cardUrl('perso', 'Work/Sprint 1/Reply to Sara.md')).toBe(
      '/w/perso/boards/Work/Sprint%201?card=Reply%20to%20Sara.md',
    )
  })

  it('names the file of a day', () => {
    expect(briefFile('2026-09-28')).toBe('Briefs/2026-09-28.md')
  })
})
