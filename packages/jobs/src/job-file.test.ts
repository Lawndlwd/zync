import { mkdir, mkdtemp, readdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  errorMessage,
  listJobs,
  nextRuns,
  parseJobFile,
  readJob,
  requestRun,
  serializeJob,
  TRIGGER_DIR,
  validateJob,
  writeJob,
} from './job-file.js'
import { buildPrompt } from './scheduler.js'
import { resolveWorkspace, safeResolve } from './workspaces.js'

const base = { name: 'weekly-report', instructions: 'Write the report.' }

describe('validateJob', () => {
  it('accepts a cron job with defaults', () => {
    const job = validateJob({ ...base, schedule: '14 15 * * 1', timezone: 'Europe/Paris' })
    expect(job).toMatchObject({ notify: 'always', enabled: true, context: [] })
  })

  it('computes next runs in the job timezone', () => {
    const job = validateJob({ ...base, schedule: '14 15 * * 1', timezone: 'Europe/Paris' })
    const runs = nextRuns(job)
    expect(runs).toHaveLength(3)
    for (const d of runs) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
      expect(parts).toBe('Mon 15:14')
    }
  })

  it('accepts a one-shot date and returns no runs when in the past', () => {
    const future = validateJob({ ...base, at: '2999-01-01T09:00', timezone: 'UTC' })
    expect(nextRuns(future)[0].toISOString()).toBe('2999-01-01T09:00:00.000Z')
    const past = validateJob({ ...base, at: '2000-01-01T09:00' })
    expect(nextRuns(past)).toEqual([])
  })

  it.each([
    [{ ...base }, 'exactly one'],
    [{ ...base, schedule: '* * * * *', at: '2999-01-01T09:00' }, 'exactly one'],
    [{ ...base, schedule: 'not a cron' }, ''],
    [{ ...base, name: 'Bad Name', schedule: '* * * * *' }, 'kebab-case'],
    [{ ...base, schedule: '* * * * *', timezone: 'Mars/Olympus' }, 'timezone'],
    [{ ...base, schedule: '* * * * *', model: 'no-slash' }, 'provider/model'],
    [{ ...base, schedule: '* * * * *', instructions: '  ' }, 'instructions'],
  ])('rejects invalid input %#', (input, msg) => {
    expect(() => validateJob(input as any)).toThrow()
    try {
      validateJob(input as any)
    } catch (err) {
      expect(errorMessage(err)).toContain(msg)
    }
  })
})

describe('job files', () => {
  it('round-trips through markdown', () => {
    const job = validateJob({ ...base, schedule: '0 9 * * *', context: ['notes/a.md'], notify: 'failure' })
    expect(parseJobFile(serializeJob(job))).toEqual(job)
  })

  it('parses unquoted YAML timestamps for "at"', () => {
    const job = parseJobFile('---\nname: x\nat: 2999-01-01T09:00:00Z\n---\nDo it\n')
    expect(job.at).toBe('2999-01-01T09:00:00Z')
  })

  it('writes, lists, refuses duplicates and queues triggers', async () => {
    const ws = await mkdtemp(path.join(tmpdir(), 'ws-'))
    const job = validateJob({ ...base, schedule: '0 9 * * *' })
    await writeJob(ws, job)
    await expect(writeJob(ws, job)).rejects.toThrow('already exists')
    await writeFile(path.join(ws, '.opencode/jobs/broken.md'), '---\nname: broken\n---\n')
    const entries = await listJobs(ws)
    expect(entries.map((e) => [e.name, Boolean(e.error)])).toEqual([
      ['broken', true],
      ['weekly-report', false],
    ])
    expect(await readJob(ws, 'weekly-report')).toEqual(job)
    await requestRun(ws, 'weekly-report')
    expect(await readdir(path.join(ws, TRIGGER_DIR))).toEqual(['weekly-report'])
  })
})

describe('buildPrompt', () => {
  it('pins the workspace directory', () => {
    const prompt = buildPrompt(validateJob({ ...base, schedule: '* * * * *' }), '/workspace/notes')
    expect(prompt).toContain('Your workspace is /workspace/notes.')
  })

  it('includes context files and instructions', () => {
    const prompt = buildPrompt(validateJob({ ...base, schedule: '* * * * *', context: ['a.md'] }))
    expect(prompt).toContain('- a.md')
    expect(prompt).toContain('Write the report.')
    expect(prompt).toContain('unattended')
  })
})

describe('workspace paths', () => {
  it('resolves names and absolute paths, rejects others', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'root-'))
    await mkdir(path.join(root, 'alpha'))
    expect((await resolveWorkspace('alpha', root)).name).toBe('alpha')
    expect((await resolveWorkspace(path.join(root, 'alpha', 'sub'), root)).name).toBe('alpha')
    await expect(resolveWorkspace('../etc', root)).rejects.toThrow()
    await expect(resolveWorkspace('missing', root)).rejects.toThrow('Unknown workspace')
    await expect(resolveWorkspace('/etc', root)).rejects.toThrow('not inside')
  })

  it('blocks traversal and symlink escape', async () => {
    const ws = await mkdtemp(path.join(tmpdir(), 'ws-'))
    const outside = await mkdtemp(path.join(tmpdir(), 'out-'))
    await symlink(outside, path.join(ws, 'link'))
    expect(await safeResolve(ws, 'notes/new.md')).toBe(path.join(ws, 'notes/new.md'))
    expect(await safeResolve(ws, '/notes/x.md')).toBe(path.join(ws, 'notes/x.md'))
    await expect(safeResolve(ws, '../x')).rejects.toThrow('escapes')
    await expect(safeResolve(ws, 'a/../../x')).rejects.toThrow('escapes')
    await expect(safeResolve(ws, 'link/secret.txt')).rejects.toThrow('symlink')
  })
})
