import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { buildBecomingPrompt } from './prompt.js'
import { createIdentity } from './store.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'becoming-prompt-'))
})

describe('buildBecomingPrompt', () => {
  it('is empty without identities', async () => {
    expect(await buildBecomingPrompt(ws)).toBe('')
  })

  it('lists identities and turns guards into standing rules', async () => {
    await createIdentity(ws, {
      statement: 'I am present at home',
      action: 'No laptop after 19:00',
      guards: [{ label: 'Present at home', from: '19:00', to: '24:00', days: ['mon', 'tue'] }],
    })
    const p = await buildBecomingPrompt(ws, '2026-09-27')
    expect(p).toContain('- I am present at home (experiment): No laptop after 19:00')
    expect(p).toContain('Never schedule events, cards, reminders or jobs inside them')
    expect(p).toContain('- 19:00–24:00 (mon, tue): Present at home (for "I am present at home") (not today)')
  })
})
