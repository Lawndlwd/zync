import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { answerQuestion, applyChange, listMirrors, readMirror, writeMirror } from './mirror.js'
import { createIdentity, readIdentity } from './store.js'
import { becomingWeek } from './week.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'becoming-mirror-'))
  await createIdentity(
    ws,
    { statement: 'I am a writer', action: 'Write', signals: [{ files: 'Writing/' }] },
    '2026-09-01',
  )
})

const words = {
  facts: [{ identity: 'writer.md', text: 'You say writer. You lived **2h10** of writing, all before 9:00.' }],
  questions: [{ identity: 'writer.md', q: 'Protect 7–9 as a guard?', options: ['Yes, guard mornings', 'Not yet'] }],
  change: {
    label: 'Add guard: Mornings 7–9 are for writing',
    identity: 'writer.md',
    patch: { guards: [{ label: 'Mornings are for writing', from: '07:00', to: '09:00' }] },
  },
}

describe('Mirror', () => {
  it('writes a week page with the numbers, and reads it back', async () => {
    const stats = await becomingWeek(ws, '2026-W39', [], '2026-09-28T09:00')
    await writeMirror(ws, stats, words)
    expect(await listMirrors(ws)).toEqual(['2026-W39'])
    const m = await readMirror(ws, '2026-W39')
    expect(m.stats.week).toBe('2026-W39')
    expect(m.facts).toEqual(words.facts)
    expect(m.questions[0]?.options).toEqual(['Yes, guard mornings', 'Not yet'])
  })

  it('keeps the user’s answers when the AI writes the week again', async () => {
    const stats = await becomingWeek(ws, '2026-W39', [], '2026-09-28T09:00')
    await writeMirror(ws, stats, words)
    await answerQuestion(ws, '2026-W39', 0, 'Yes, guard mornings')
    await writeMirror(ws, stats, words)
    expect((await readMirror(ws, '2026-W39')).questions[0]?.answer).toBe('Yes, guard mornings')
  })

  it('applies the one change once', async () => {
    await writeMirror(ws, await becomingWeek(ws, '2026-W39', [], '2026-09-28T09:00'), words)
    await applyChange(ws, '2026-W39')
    expect((await readIdentity(ws, 'writer.md')).guards).toEqual([
      { label: 'Mornings are for writing', from: '07:00', to: '09:00' },
    ])
    expect((await readMirror(ws, '2026-W39')).change?.applied).toBe(true)
    await expect(applyChange(ws, '2026-W39')).rejects.toThrow(/already applied/)
  })

  it('404s on a week without a Mirror', async () => {
    await expect(readMirror(ws, '2026-W30')).rejects.toThrow(/No Mirror/)
  })
})
