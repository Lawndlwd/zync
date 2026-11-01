import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createBoard, createCard, updateCard } from '../boards/index.js'
import { readActivity } from './activity.js'
import { ActivityRecorder } from './recorder.js'

let ws: { name: string; path: string }
let recorder: ActivityRecorder

beforeEach(async () => {
  ws = { name: 'personal', path: await mkdtemp(path.join(tmpdir(), 'becoming-rec-')) }
  recorder = new ActivityRecorder()
})

afterEach(() => {
  recorder.stop()
})

const all = () => readActivity(ws.path, '0000', '9999')

describe('ActivityRecorder', () => {
  it('logs edits to the user’s files, not Zync’s own', async () => {
    await mkdir(path.join(ws.path, 'Writing'))
    await mkdir(path.join(ws.path, 'Becoming'))
    await recorder.sync([ws])
    await writeFile(path.join(ws.path, 'Becoming', 'writer.md'), 'x')
    await writeFile(path.join(ws.path, 'Writing', 'Essay.md'), 'draft')
    await vi.waitFor(async () => expect((await all()).map((a) => a.path)).toContain('Writing/Essay.md'), {
      timeout: 3000,
    })
    const paths = (await all()).map((a) => a.path)
    expect(paths.every((p) => p.startsWith('Writing/'))).toBe(true)
  })

  it('tells a card reaching the last column from an edit', async () => {
    await createBoard(ws.path, { name: 'ideas' })
    const card = await createCard(ws.path, 'ideas', { title: 'Ship it', labels: ['ship'] })
    await recorder.sync([ws])
    await updateCard(ws.path, 'ideas', card.file, { status: 'done' })
    await vi.waitFor(
      async () => expect((await all()).find((a) => a.kind === 'card-done')).toMatchObject({ labels: ['ship'] }),
      { timeout: 3000 },
    )
  })
})
