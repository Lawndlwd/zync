import { describe, expect, it } from 'vitest'

import { mdBlocks, mdSpans } from './markdownLite'

describe('markdownLite', () => {
  it('reads headings, bullets and paragraphs', () => {
    expect(mdBlocks('## Meetings\n- **09:30** Standup\n1. first\n\nSome text\nwrapped here')).toEqual([
      { type: 'h', text: 'Meetings' },
      { type: 'li', text: '**09:30** Standup' },
      { type: 'li', text: 'first' },
      { type: 'p', text: 'Some text wrapped here' },
    ])
  })

  it('reads inline bold, italic, code and links', () => {
    expect(mdSpans('**Sara**: the *offer* · [open](https://mail.google.com/x) `id`')).toEqual([
      { text: 'Sara', bold: true },
      { text: ': the ' },
      { text: 'offer', italic: true },
      { text: ' · ' },
      { text: 'open', href: 'https://mail.google.com/x' },
      { text: ' ' },
      { text: 'id', code: true },
    ])
  })

  it('never makes a script link', () => {
    expect(mdSpans('[x](javascript:alert(1))')[0]).toEqual({ text: 'x' })
    expect(mdSpans('[p](Work/Card.md)')).toEqual([{ text: 'p', href: 'Work/Card.md' }])
  })
})
