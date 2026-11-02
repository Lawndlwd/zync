import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { clearAllRunning, markRunning, readRunning } from './active-runs.js'
import { validateJob, writeJob } from './job-file.js'
import { OpencodeClient, type SessionResult } from './opencode.js'
import { readRuns } from './runs.js'
import { Scheduler } from './scheduler.js'

/** opencode without a server: sessions are numbered, and finish when `done` says so. */
class FakeOpencode extends OpencodeClient {
  sessions = 0
  done = false
  override async createSession(): Promise<string> {
    this.sessions += 1
    return `ses_${this.sessions}`
  }
  override async promptAsync(): Promise<void> {}
  override async abort(): Promise<void> {}
  override async sessionResult(): Promise<SessionResult> {
    return { done: this.done, failed: false, text: 'Brief written' }
  }
}

let root: string
let ws: { name: string; path: string }

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'active-'))
  ws = { name: 'w', path: path.join(root, 'w') }
  await writeJob(ws.path, validateJob({ name: 'daily', schedule: '0 7 * * *', instructions: 'Do it' }))
})

describe('running jobs', () => {
  it('reads back what was marked, and nothing once cleared', async () => {
    const run = { sessionId: 'ses_1', started: '2026-09-28T07:00:00.000Z', trigger: 'manual' as const }
    await markRunning(ws.path, 'daily', run)
    expect(await readRunning(ws.path, 'daily')).toEqual(run)
    await clearAllRunning(ws.path)
    expect(await readRunning(ws.path, 'daily')).toBeNull()
  })

  it('the scheduler marks a run with its session while it runs, and clears it when it ends', async () => {
    const client = new FakeOpencode()
    const scheduler = new Scheduler(client, { root })
    await scheduler.fire(ws, 'daily', 'manual')
    expect(await readRunning(ws.path, 'daily')).toMatchObject({ sessionId: 'ses_1', trigger: 'manual' })

    // A second start while it runs is skipped and keeps the first session.
    await scheduler.fire(ws, 'daily', 'manual')
    expect((await readRuns(ws.path, 'daily'))[0]?.status).toBe('skipped')
    expect(await readRunning(ws.path, 'daily')).toMatchObject({ sessionId: 'ses_1' })

    client.done = true
    // `poll` checks runs older than 10 s: pretend it started long ago.
    const later = Date.now() + 60_000
    const realNow = Date.now
    Date.now = () => later
    try {
      await scheduler.poll()
    } finally {
      Date.now = realNow
    }
    expect(await readRunning(ws.path, 'daily')).toBeNull()
    expect((await readRuns(ws.path, 'daily'))[0]).toMatchObject({ status: 'ok', sessionId: 'ses_1' })
  })
})
