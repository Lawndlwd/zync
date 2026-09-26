import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Cron } from 'croner'
import { buildCron, errorMessage, type Job, listJobs, readJob, TRIGGER_DIR, writeJob } from './job-file.js'
import { notify, sessionLink, shouldNotify } from './notify.js'
import { OpencodeClient } from './opencode.js'
import { appendRun, type RunRecord } from './runs.js'
import { listWorkspaces, type Workspace, workspacesRoot } from './workspaces.js'

interface Registered {
  ws: Workspace
  job: Job
  cron: Cron
}

interface Running {
  key: string
  ws: Workspace
  job: Job
  sessionId: string
  started: number
  trigger: RunRecord['trigger']
  finishing?: boolean
}

export interface SchedulerOptions {
  root?: string
  scanMs?: number
  pollMs?: number
  timeoutMs?: number
}

const log = (...args: unknown[]) => console.log(new Date().toISOString(), '[scheduler]', ...args)

export function buildPrompt(job: Job): string {
  const lines = [
    `You are running the scheduled job "${job.name}" unattended. No human is watching this session,`,
    'so do not ask questions: make reasonable decisions and complete the task.',
    '',
  ]
  if (job.context.length) {
    lines.push('Before starting, read these files/folders for context:')
    for (const c of job.context) lines.push(`- ${c}`)
    lines.push('')
  }
  lines.push('## Task', job.instructions, '')
  lines.push('When finished, reply with a short summary of what you did and where the results are.')
  return lines.join('\n')
}

export class Scheduler {
  private registered = new Map<string, Registered>()
  private running = new Map<string, Running>()
  private known = new Map<string, number>() // key → mtime of last processed job file
  private timers: NodeJS.Timeout[] = []
  private unsubscribe?: () => void
  private readonly root: string
  private readonly scanMs: number
  private readonly pollMs: number
  private readonly timeoutMs: number

  constructor(
    private client: OpencodeClient,
    opts: SchedulerOptions = {},
  ) {
    this.root = opts.root ?? workspacesRoot()
    this.scanMs = opts.scanMs ?? 5_000
    this.pollMs = opts.pollMs ?? 15_000
    this.timeoutMs = opts.timeoutMs ?? 30 * 60_000
  }

  start(): void {
    log(`watching ${this.root} (opencode: ${this.client.baseUrl})`)
    this.unsubscribe = this.client.subscribe(
      (e) => this.onEvent(e),
      (ok) => log(ok ? 'event stream connected' : 'event stream disconnected, retrying'),
    )
    void this.scan()
    this.timers.push(setInterval(() => void this.scan(), this.scanMs))
    this.timers.push(setInterval(() => void this.poll(), this.pollMs))
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t)
    for (const r of this.registered.values()) r.cron.stop()
    this.registered.clear()
    this.unsubscribe?.()
  }

  /** Sync registered crons with job files on disk and consume run-now triggers. */
  async scan(): Promise<void> {
    const seen = new Set<string>()
    for (const ws of await listWorkspaces(this.root)) {
      for (const entry of await listJobs(ws.path)) {
        const key = `${ws.name}/${entry.name}`
        seen.add(key)
        // Only (re)process files that changed since the last scan.
        if (this.known.get(key) === entry.mtimeMs) continue
        this.known.set(key, entry.mtimeMs)
        const wasRegistered = this.registered.has(key)
        this.unregister(key)
        if (entry.error || !entry.job) {
          log(`invalid job ${key}: ${entry.error}`)
          continue
        }
        if (!entry.job.enabled) {
          if (wasRegistered) log(`disabled ${key}`)
          continue
        }
        const cron = buildCron(entry.job, {}, () => void this.fire(ws, entry.name, 'schedule'))
        const next = cron.nextRun()
        if (!next) {
          cron.stop()
          log(`job ${key} has no future run (past "at" date?), not scheduled`)
          continue
        }
        this.registered.set(key, { ws, job: entry.job, cron })
        log(`${wasRegistered ? 're-registered' : 'registered'} ${key}, next run ${next.toISOString()}`)
      }
      await this.consumeTriggers(ws)
    }
    for (const key of this.known.keys()) {
      if (seen.has(key)) continue
      this.known.delete(key)
      this.unregister(key, true)
    }
  }

  private unregister(key: string, removed = false): void {
    const r = this.registered.get(key)
    r?.cron.stop()
    this.registered.delete(key)
    if (removed) log(`removed ${key}`)
  }

  private async consumeTriggers(ws: Workspace): Promise<void> {
    const dir = path.join(ws.path, TRIGGER_DIR)
    const names = await readdir(dir).catch(() => [] as string[])
    for (const name of names) {
      await rm(path.join(dir, name), { force: true })
      log(`manual trigger for ${ws.name}/${name}`)
      void this.fire(ws, name, 'manual')
    }
  }

  async fire(ws: Workspace, name: string, trigger: RunRecord['trigger']): Promise<void> {
    const key = `${ws.name}/${name}`
    let job: Job
    try {
      job = await readJob(ws.path, name)
    } catch (err) {
      log(`cannot run ${key}: ${errorMessage(err)}`)
      return
    }
    if ([...this.running.values()].some((r) => r.key === key)) {
      log(`skip ${key}: previous run still active`)
      await this.record(ws, job, { status: 'skipped', summary: 'Previous run still active', trigger })
      return
    }
    const started = Date.now()
    let sessionId: string | undefined
    try {
      const title = `[job] ${name} · ${new Date(started).toISOString().slice(0, 16).replace('T', ' ')}`
      const agent = job.agent || process.env.JOB_DEFAULT_AGENT || 'job'
      sessionId = await this.client.createSession(ws.path, title, agent)
      this.running.set(sessionId, { key, ws, job, sessionId, started, trigger })
      await this.client.promptAsync(sessionId, ws.path, buildPrompt(job), { agent, model: job.model })
      log(`started ${key} → session ${sessionId}`)
    } catch (err) {
      if (sessionId) this.running.delete(sessionId)
      log(`failed to start ${key}: ${errorMessage(err)}`)
      await this.record(ws, job, {
        status: 'failed',
        sessionId,
        summary: `Could not start: ${errorMessage(err)}`,
        trigger,
        durationMs: Date.now() - started,
      })
    }
    if (job.at && trigger === 'schedule') {
      // One-shot jobs disable themselves once fired.
      await writeJob(ws.path, { ...job, enabled: false }, { overwrite: true }).catch((err) =>
        log(`could not disable one-shot ${key}: ${errorMessage(err)}`),
      )
    }
  }

  private onEvent(e: any): void {
    const type = e?.payload?.type
    const sid = e?.payload?.properties?.sessionID
    if (!sid || !this.running.has(sid)) return
    if (type === 'session.idle' || type === 'session.error') void this.complete(sid)
  }

  /** Fallback for missed events, plus timeout enforcement. */
  async poll(): Promise<void> {
    const now = Date.now()
    for (const r of [...this.running.values()]) {
      if (now - r.started > this.timeoutMs) await this.complete(r.sessionId, true)
      else if (now - r.started > 10_000) await this.complete(r.sessionId)
    }
  }

  private async complete(sessionId: string, timedOut = false): Promise<void> {
    const r = this.running.get(sessionId)
    if (!r || r.finishing) return
    r.finishing = true
    try {
      let status: RunRecord['status']
      let summary: string
      if (timedOut) {
        await this.client.abort(sessionId, r.ws.path)
        status = 'timeout'
        summary = `Aborted after ${Math.round(this.timeoutMs / 60_000)} min`
      } else {
        const res = await this.client.sessionResult(sessionId, r.ws.path)
        if (!res.done) {
          r.finishing = false
          return
        }
        status = res.failed ? 'failed' : 'ok'
        summary = res.failed ? `Error: ${res.error}\n${res.text}`.trim() : res.text
      }
      this.running.delete(sessionId)
      log(`finished ${r.key}: ${status}`)
      await this.record(r.ws, r.job, {
        status,
        sessionId,
        summary,
        trigger: r.trigger,
        durationMs: Date.now() - r.started,
      })
    } catch (err) {
      r.finishing = false
      log(`could not check ${r.key}: ${errorMessage(err)}`)
    }
  }

  private async record(ws: Workspace, job: Job, run: Omit<RunRecord, 'ts'>): Promise<void> {
    const rec: RunRecord = { ts: new Date().toISOString(), ...run }
    await appendRun(ws.path, job.name, rec).catch((err) => log(`could not write run log: ${errorMessage(err)}`))
    if (shouldNotify(job.notify, rec)) {
      await notify({ workspace: ws.name, job: job.name, run: rec, link: sessionLink(ws.name, rec.sessionId) })
    }
  }
}

function main() {
  const timeoutMin = Number(process.env.JOB_TIMEOUT_MIN || 30)
  const scheduler = new Scheduler(new OpencodeClient(), { timeoutMs: timeoutMin * 60_000 })
  scheduler.start()
  const shutdown = () => {
    scheduler.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
