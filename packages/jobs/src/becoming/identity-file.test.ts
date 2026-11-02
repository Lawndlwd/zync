import { describe, expect, it } from 'vitest'

import { parseIdentity, serializeIdentity, splitProof } from './identity-file.js'

const page = `---
statement: I am a writer
action: Write 300 words
small: One sentence
when: morning
minutes: 40
signals:
  - files: Writing/
  - card: { label: essay }
stage: trying
since: 2026-08-31
colour: green
---

I think better when I write.

## Proof
- 2026-09-28 · 40 min in Essay.md · auto
- 2026-09-25 · small: one sentence · tap
`

describe('identity file', () => {
  it('reads the frontmatter, the why and the proof', () => {
    const i = parseIdentity('writer.md', page)
    expect(i.statement).toBe('I am a writer')
    expect(i.when).toBe('morning')
    expect(i.signals).toEqual([{ files: 'Writing/' }, { card: { label: 'essay' } }])
    expect(i.stageSince).toBe('2026-08-31')
    expect(i.why).toBe('I think better when I write.')
    expect(i.proof).toEqual([
      { date: '2026-09-28', text: '40 min in Essay.md', source: 'auto' },
      { date: '2026-09-25', text: 'small: one sentence', source: 'tap' },
    ])
  })

  it('keeps unknown and invalid fields', () => {
    const i = parseIdentity('writer.md', page.replace('when: morning', 'when: someday'))
    expect(i.extra).toEqual({ colour: 'green', when: 'someday' })
    expect(serializeIdentity(i)).toContain('colour: green')
  })

  it('writes back what it read', () => {
    const i = parseIdentity('writer.md', page)
    expect(parseIdentity('writer.md', serializeIdentity(i))).toEqual(i)
  })

  it('keeps sections written after the proof in the why', () => {
    expect(splitProof('Why.\n\n## Proof\n- 2026-09-28 · x · auto\n\n## Notes\nmore')).toEqual({
      why: 'Why.\n\n## Notes\nmore',
      proof: [{ date: '2026-09-28', text: 'x', source: 'auto' }],
    })
  })
})
