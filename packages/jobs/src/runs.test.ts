import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { runsPath } from './job-file.js'
import { appendRun, readRuns, type RunRecord } from './runs.js'

let ws: string
beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-runs-'))
  await mkdir(path.dirname(runsPath(ws, 'daily')), { recursive: true })
})

const run = (ts: string): RunRecord => ({ ts, status: 'ok', summary: ts, trigger: 'schedule' })
// Summaries long enough (and multi-byte) that a log spans several 64 KB chunks.
const long = (ts: string): RunRecord => ({ ...run(ts), summary: `${ts} ${'é'.repeat(1500)}` })

describe('runs', () => {
  it('returns the most recent runs first, up to the limit', async () => {
    for (const ts of ['1', '2', '3']) await appendRun(ws, 'daily', run(ts))
    expect((await readRuns(ws, 'daily', 2)).map((r) => r.ts)).toEqual(['3', '2'])
  })

  it('skips corrupt and blank lines', async () => {
    await writeFile(runsPath(ws, 'daily'), `${JSON.stringify(run('1'))}\n{broken\n\n${JSON.stringify(run('2'))}\n`)
    expect((await readRuns(ws, 'daily')).map((r) => r.ts)).toEqual(['2', '1'])
  })

  it('is empty for a job that never ran', async () => {
    expect(await readRuns(ws, 'never')).toEqual([])
  })
})

describe('runs from a long log', () => {
  it('reads across chunk boundaries', async () => {
    for (let i = 0; i < 100; i++) await appendRun(ws, 'daily', long(String(i)))
    const all = await readRuns(ws, 'daily', 1000)
    expect(all).toHaveLength(100)
    expect(all.every((r) => r.summary.endsWith('é'.repeat(1500)))).toBe(true)
    expect(all.map((r) => r.ts)).toEqual(Array.from({ length: 100 }, (_, i) => String(99 - i)))
    expect((await readRuns(ws, 'daily', 1))[0]?.ts).toBe('99')
  })
})
