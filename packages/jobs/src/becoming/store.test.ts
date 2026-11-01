import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { appendActivity } from './activity.js'
import { castVote, finalizeDays } from './cast.js'
import { createIdentity, identitySlug, listIdentities, readIdentity, updateIdentity } from './store.js'
import { readVotes, standingVotes, voteKey } from './votes.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'becoming-'))
})

const writer = {
  statement: 'I am a writer',
  action: 'Write 300 words',
  small: 'One sentence',
  signals: [{ files: 'Writing/' }],
}

describe('identities', () => {
  it('names the file after the statement', () => {
    expect(identitySlug('I am a writer')).toBe('writer')
    expect(identitySlug("I'm someone who ships")).toBe('someone-who-ships')
  })

  it('creates a page in Becoming/ that reads back', async () => {
    const created = await createIdentity(ws, writer, '2026-09-28')
    expect(created.file).toBe('writer.md')
    expect(await readIdentity(ws, 'writer.md')).toEqual(created)
    const src = await readFile(path.join(ws, 'Becoming', 'writer.md'), 'utf8')
    expect(src).toContain('statement: I am a writer')
  })

  it('allows one experiment at a time', async () => {
    await createIdentity(ws, writer)
    await expect(createIdentity(ws, { statement: 'I am a runner', action: 'Run' })).rejects.toThrow(/One experiment/)
    await createIdentity(ws, { statement: 'I am a runner', action: 'Run', stage: 'trying' })
    expect((await listIdentities(ws)).map((i) => i.file).toSorted()).toEqual(['runner.md', 'writer.md'])
  })

  it('restarts the stage clock when the stage changes', async () => {
    await createIdentity(ws, writer, '2026-09-01')
    const next = await updateIdentity(ws, 'writer.md', { stage: 'trying' })
    expect(next.stage).toBe('trying')
    expect(next.stageSince).not.toBe('2026-09-01')
    expect(next.since).toBe('2026-09-01')
  })
})

describe('votes', () => {
  it('records a vote and its proof, and an undo removes both', async () => {
    await createIdentity(ws, writer)
    await castVote(ws, 'writer.md', '2026-09-28', 'small', 'tap')
    expect((await readIdentity(ws, 'writer.md')).proof).toEqual([
      { date: '2026-09-28', text: 'small: one sentence', source: 'tap' },
    ])
    expect(standingVotes(await readVotes(ws)).get(voteKey('2026-09-28', 'writer.md'))?.kind).toBe('small')
    await castVote(ws, 'writer.md', '2026-09-28', 'clear', 'tap')
    expect(standingVotes(await readVotes(ws)).size).toBe(0)
    expect((await readIdentity(ws, 'writer.md')).proof).toEqual([])
  })

  it('turns what Zync saw into votes once, leaving votes the user cast', async () => {
    await createIdentity(ws, writer, '2026-09-20')
    await mkdir(path.join(ws, 'Writing'))
    await writeFile(path.join(ws, 'Writing', 'Essay.md'), 'x')
    await appendActivity(ws, [
      { t: '2026-09-26T07:10', path: 'Writing/Essay.md', kind: 'edit' },
      { t: '2026-09-26T07:18', path: 'Writing/Essay.md', kind: 'edit' },
      { t: '2026-09-26T07:26', path: 'Writing/Essay.md', kind: 'edit' },
      { t: '2026-09-26T07:35', path: 'Writing/Essay.md', kind: 'edit' },
      { t: '2026-09-27T07:10', path: 'Writing/Essay.md', kind: 'edit' },
    ])
    await castVote(ws, 'writer.md', '2026-09-27', 'full', 'tap')
    expect(await finalizeDays(ws, '2026-09-28')).toBe(1)
    expect(await finalizeDays(ws, '2026-09-28')).toBe(0)
    const standing = standingVotes(await readVotes(ws))
    expect(standing.get(voteKey('2026-09-26', 'writer.md'))).toEqual({
      kind: 'full',
      source: 'auto',
      note: '30 min in Essay.md',
    })
    expect(standing.get(voteKey('2026-09-27', 'writer.md'))?.source).toBe('tap')
  })
})
