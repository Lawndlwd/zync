import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { createBoard, createCard, updateCard } from '../boards/index.js'
import { castVote } from './cast.js'
import { createIdentity } from './store.js'
import { becomingToday } from './today.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'becoming-today-'))
  await createIdentity(
    ws,
    {
      statement: 'I am a writer',
      action: 'Write',
      small: 'One sentence',
      when: 'morning',
      signals: [{ files: 'Writing/' }],
      stage: 'trying',
    },
    '2026-09-01',
  )
  await createIdentity(
    ws,
    { statement: 'I am a runner', action: 'Run 5k', small: 'Shoes on', when: '18:00', signals: [{ manual: true }] },
    '2026-09-01',
  )
})

const meeting = (from: string, to: string) => ({ title: 'Sync', start: `2026-09-28T${from}`, end: `2026-09-28T${to}` })
const heavyDay = ['09:00', '10:00', '11:00', '13:00', '15:00'].map((h) => meeting(h, `${h.slice(0, 2)}:50`))

describe('becomingToday', () => {
  it('asks for small versions on a heavy day and puts yesterday’s miss first', async () => {
    await castVote(ws, 'writer.md', '2026-09-27', 'full', 'tap')
    const t = await becomingToday(ws, '2026-09-28', heavyDay, '2026-09-28T12:40')
    expect(t.day.mode).toBe('heavy')
    expect(t.rows.map((r) => [r.identity.file, r.target, r.missedYesterday])).toEqual([
      ['runner.md', 'small', true],
      ['writer.md', 'small', false],
    ])
    expect(t.rows[0]?.manual).toBe(true)
  })

  it('asks for the full version on an open day, with a vote once cast', async () => {
    await castVote(ws, 'runner.md', '2026-09-28', 'full', 'tap')
    const t = await becomingToday(ws, '2026-09-28', [], '2026-09-28T12:40')
    const runner = t.rows.find((r) => r.identity.file === 'runner.md')
    expect(runner).toMatchObject({ target: 'full', vote: { kind: 'full', source: 'tap' } })
    expect(runner?.slot?.start).toBe('2026-09-28T18:00')
    expect(runner?.strip.at(-1)).toBe('full')
  })

  it('names the soonest open card that votes for an identity', async () => {
    await createIdentity(ws, {
      statement: 'I am a builder',
      action: 'Close a card',
      signals: [{ card: { label: 'ship' } }],
      stage: 'part',
    })
    await createBoard(ws, { name: 'ideas' })
    await createCard(ws, 'ideas', { title: 'Later', labels: ['ship'], due: '2026-10-10' })
    await createCard(ws, 'ideas', { title: 'Finish calendar refactor', labels: ['ship'], due: '2026-09-28' })
    const done = await createCard(ws, 'ideas', { title: 'Old', labels: ['ship'], due: '2026-09-01' })
    await updateCard(ws, 'ideas', done.file, { status: 'done' })
    const t = await becomingToday(ws, '2026-09-28', [], '2026-09-28T12:40')
    expect(t.oneCard).toEqual({
      title: 'Finish calendar refactor',
      board: 'ideas',
      file: 'Finish calendar refactor.md',
      identity: 'builder.md',
    })
  })
})
