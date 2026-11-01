import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { appendActivity } from './activity.js'
import { BecomingDaily } from './daily.js'
import { createIdentity } from './store.js'
import { readVotes } from './votes.js'

let ws: { name: string; path: string }

beforeEach(async () => {
  ws = { name: 'personal', path: await mkdtemp(path.join(tmpdir(), 'becoming-daily-')) }
  await createIdentity(
    ws.path,
    { statement: 'I am a writer', action: 'Write', signals: [{ files: 'Writing/' }] },
    '2026-09-20',
  )
  await appendActivity(ws.path, [{ t: '2026-09-27T07:10', path: 'Writing/Essay.md', kind: 'edit' }])
})

describe('BecomingDaily', () => {
  it('turns yesterday into votes once, after 03:00', async () => {
    const daily = new BecomingDaily()
    await daily.tick([ws], '2026-09-28T02:30')
    expect(await readVotes(ws.path)).toEqual([])
    await daily.tick([ws], '2026-09-28T03:05')
    await daily.tick([ws], '2026-09-28T03:10')
    expect((await readVotes(ws.path)).map((v) => [v.date, v.kind, v.source])).toEqual([['2026-09-27', 'small', 'auto']])
  })
})
