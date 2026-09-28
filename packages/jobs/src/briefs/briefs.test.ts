import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { readJob } from '../job-file.js'
import {
  BRIEF_JOB,
  BRIEFS_DIR,
  enableBriefJob,
  linkTodo,
  listBriefs,
  parseBrief,
  readBrief,
  setTodoDone,
  writeBrief,
} from './index.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'briefs-'))
})

const input = {
  body: '## Meetings\n- 14:00 Design review',
  todos: [
    { title: 'Reply to Sara', source: 'Gmail · work', link: 'https://mail.google.com/x' },
    { title: 'Prepare the review', source: 'Calendar' },
  ],
  sources: ['Gmail · work', 'Calendar'],
}

describe('briefs', () => {
  it('writes a page per day that reads back the same', async () => {
    await writeBrief(ws, '2026-09-28', input)
    const src = await readFile(path.join(ws, BRIEFS_DIR, '2026-09-28.md'), 'utf8')
    expect(src).toContain('## To-do\n- [ ] Reply to Sara — Gmail · work · [open](https://mail.google.com/x)')
    expect(src).not.toContain('todos:')
    expect(await readBrief(ws, '2026-09-28')).toEqual({
      date: '2026-09-28',
      extra: {},
      ...input,
      todos: input.todos.map((t) => ({ ...t, done: false })),
    })
  })

  it('keeps ticks and cards when the day is written again', async () => {
    await writeBrief(ws, '2026-09-28', input)
    await linkTodo(ws, '2026-09-28', 0, 'Work/Reply to Sara.md')
    await setTodoDone(ws, '2026-09-28', 1, true)
    const again = await writeBrief(ws, '2026-09-28', { ...input, todos: [...input.todos, { title: 'New one' }] })
    expect(again.todos.map((t) => [t.card, t.done])).toEqual([
      ['Work/Reply to Sara.md', false],
      [undefined, true],
      [undefined, false],
    ])
  })

  it('reads briefs that kept their to-dos in the frontmatter, and moves them into the page', async () => {
    await mkdir(path.join(ws, BRIEFS_DIR), { recursive: true })
    const file = path.join(ws, BRIEFS_DIR, '2026-09-27.md')
    await writeFile(file, '---\ntodos:\n  - title: Old one\n    source: Gmail\n---\n## Mail\n')
    expect((await readBrief(ws, '2026-09-27')).todos).toEqual([{ title: 'Old one', source: 'Gmail', done: false }])
    await setTodoDone(ws, '2026-09-27', 0, true)
    expect((await readFile(file, 'utf8')).trim()).toBe('## To-do\n- [x] Old one — Gmail\n\n## Mail')
  })

  it('never writes the checklist twice when the markdown has one too', async () => {
    const b = await writeBrief(ws, '2026-09-28', { ...input, body: '## To-do\n- [ ] dup\n\n## Mail\nok' })
    expect(b.body).toBe('## Mail\nok')
  })

  it('lists days in a range with how many to-dos are still open', async () => {
    await writeBrief(ws, '2026-09-27', input)
    await writeBrief(ws, '2026-09-28', input)
    await linkTodo(ws, '2026-09-28', 1, 'Work/Prepare the review.md')
    await setTodoDone(ws, '2026-09-28', 0, true)
    await mkdir(path.join(ws, BRIEFS_DIR), { recursive: true })
    await writeFile(path.join(ws, BRIEFS_DIR, 'notes.md'), 'not a brief')
    expect(await listBriefs(ws, '2026-09-28', '2026-09-30')).toEqual([{ date: '2026-09-28', todos: 2, open: 0 }])
    expect((await listBriefs(ws)).map((b) => b.date)).toEqual(['2026-09-27', '2026-09-28'])
  })

  it('refuses dates that are not days, and unknown to-dos', async () => {
    await expect(writeBrief(ws, '../x', input)).rejects.toThrow(/must look like/)
    await expect(readBrief(ws, '2026-01-01')).rejects.toMatchObject({ status: 404 })
    await writeBrief(ws, '2026-09-28', input)
    await expect(linkTodo(ws, '2026-09-28', 5, 'x.md')).rejects.toMatchObject({ status: 400 })
  })

  it('reads a hand-edited page leniently: bad to-dos are dropped, other keys kept', () => {
    const b = parseBrief('2026-09-28', '---\ntodos:\n  - title: Ok\n  - nope: 1\nmood: good\n---\nBody')
    expect(b.todos).toEqual([{ title: 'Ok', done: false }])
    expect(b.extra).toEqual({ mood: 'good' })
    expect(b.body).toBe('Body')
  })

  it('sets up the daily job once', async () => {
    await enableBriefJob(ws, 'perso')
    const job = await readJob(ws, BRIEF_JOB)
    expect(job.schedule).toBe('0 7 * * *')
    expect(job.instructions).toContain('"perso"')
    await expect(enableBriefJob(ws, 'perso')).rejects.toMatchObject({ status: 409 })
  })
})
