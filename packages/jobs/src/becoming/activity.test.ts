import { describe, expect, it } from 'vitest'

import { isWorkPath, sessions } from './activity.js'
import type { Activity } from './types.js'

const edit = (t: string, path = 'Writing/Essay.md'): Activity => ({ t: `2026-09-28T${t}`, path, kind: 'edit' })

describe('isWorkPath', () => {
  it.each([
    ['Writing/Essay.md', true],
    ['README.md', true],
    ['Becoming/writer.md', false],
    ['Briefs/2026-09-28.md', false],
    ['.opencode/jobs/x.md', false],
    ['app/node_modules/x.js', false],
  ])('%s → %s', (rel, want) => {
    expect(isWorkPath(rel)).toBe(want)
  })
})

describe('sessions', () => {
  it('joins edits less than 10 minutes apart', () => {
    const s = sessions([edit('07:10'), edit('07:18'), edit('07:25', 'Writing/notes.md'), edit('07:30')])
    expect(s).toEqual([
      {
        start: '2026-09-28T07:10',
        end: '2026-09-28T07:30',
        minutes: 25,
        files: ['Writing/Essay.md', 'Writing/notes.md'],
      },
    ])
  })

  it('splits on a longer pause and gives a single save 5 minutes', () => {
    const s = sessions([edit('07:10'), edit('09:00')])
    expect(s.map((x) => x.minutes)).toEqual([5, 5])
  })
})
