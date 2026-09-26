import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Cron } from 'croner'
import matter from 'gray-matter'
import { z } from 'zod'

export const JOBS_DIR = path.join('.opencode', 'jobs')
export const TRIGGER_DIR = path.join(JOBS_DIR, '.trigger')

export function defaultTimezone(): string {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// YAML turns unquoted timestamps into Date objects; normalise back to a string.
const atField = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().replace(/\.000Z$/, 'Z') : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/, {
    message: 'at must be an ISO date-time like 2026-09-28T15:14',
  }),
)

export const JobMetaSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, { message: 'name must be lowercase kebab-case (a-z, 0-9, -)' }),
    schedule: z.string().trim().min(1).optional(),
    at: atField.optional(),
    timezone: z.string().refine(isValidTimezone, { message: 'unknown IANA timezone' }).optional(),
    agent: z.string().min(1).optional(),
    model: z
      .string()
      .regex(/^[^/\s]+\/\S+$/, { message: 'model must look like provider/model-id' })
      .optional(),
    context: z.array(z.string()).default([]),
    notify: z.enum(['always', 'failure', 'never']).default('always'),
    enabled: z.boolean().default(true),
    // Set on jobs generated from a kanban card ("<board>/<cardId>"); the scheduler moves the card.
    card: z.string().min(1).optional(),
  })
  .refine((j) => Boolean(j.schedule) !== Boolean(j.at), {
    message: 'set exactly one of "schedule" (cron) or "at" (one-shot date-time)',
  })

export type JobMeta = z.infer<typeof JobMetaSchema>

export interface Job extends JobMeta {
  instructions: string
}

export interface JobInput extends Omit<z.input<typeof JobMetaSchema>, 'name'> {
  name: string
  instructions: string
}

export function validateJob(input: JobInput): Job {
  const { instructions, ...meta } = input
  const parsed = JobMetaSchema.parse(meta)
  if (!instructions?.trim()) throw new Error('instructions must not be empty')
  const job: Job = { ...parsed, instructions: instructions.trim() }
  // Throws on an invalid cron pattern or date.
  buildCron(job, { paused: true }).stop()
  return job
}

export function parseJobFile(source: string): Job {
  const { data, content } = matter(source)
  return validateJob({ ...(data as JobInput), instructions: content })
}

export function serializeJob(job: Job): string {
  const meta: Record<string, unknown> = { name: job.name }
  if (job.schedule) meta.schedule = job.schedule
  if (job.at) meta.at = job.at
  if (job.timezone) meta.timezone = job.timezone
  if (job.agent) meta.agent = job.agent
  if (job.model) meta.model = job.model
  if (job.context.length) meta.context = job.context
  meta.notify = job.notify
  meta.enabled = job.enabled
  if (job.card) meta.card = job.card
  return matter.stringify(`\n${job.instructions}\n`, meta)
}

export function buildCron(job: Job, opts: { paused?: boolean } = {}, fn?: () => void): Cron {
  const pattern = job.schedule ?? (job.at as string)
  return new Cron(pattern, { timezone: job.timezone || defaultTimezone(), paused: opts.paused, protect: true }, fn)
}

export function nextRuns(job: Job, count = 3): Date[] {
  if (!job.enabled) return []
  const cron = buildCron(job, { paused: true })
  const runs = cron.nextRuns(count)
  cron.stop()
  return runs
}

export function jobPath(wsPath: string, name: string): string {
  return path.join(wsPath, JOBS_DIR, `${name}.md`)
}

export function runsPath(wsPath: string, name: string): string {
  return path.join(wsPath, JOBS_DIR, `${name}.runs.jsonl`)
}

export interface JobEntry {
  job?: Job
  error?: string
  file: string
  name: string
  mtimeMs: number
}

export async function listJobs(wsPath: string): Promise<JobEntry[]> {
  const dir = path.join(wsPath, JOBS_DIR)
  const files = await readdir(dir).catch(() => [] as string[])
  const out: JobEntry[] = []
  for (const f of files.filter((f) => f.endsWith('.md')).sort()) {
    const file = path.join(dir, f)
    const name = f.slice(0, -3)
    try {
      const [src, s] = await Promise.all([readFile(file, 'utf8'), stat(file)])
      const job = parseJobFile(src)
      out.push({ job, file, name, mtimeMs: s.mtimeMs })
    } catch (err) {
      out.push({ file, name, mtimeMs: 0, error: errorMessage(err) })
    }
  }
  return out
}

export async function readJob(wsPath: string, name: string): Promise<Job> {
  const src = await readFile(jobPath(wsPath, name), 'utf8').catch(() => {
    throw Object.assign(new Error(`Job "${name}" not found`), { status: 404 })
  })
  return parseJobFile(src)
}

export async function writeJob(wsPath: string, job: Job, opts: { overwrite?: boolean } = {}): Promise<string> {
  const file = jobPath(wsPath, job.name)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, serializeJob(job), { flag: opts.overwrite ? 'w' : 'wx' }).catch((err) => {
    if (err.code === 'EEXIST') throw new Error(`Job "${job.name}" already exists; use update_job`)
    throw err
  })
  return file
}

export async function deleteJob(wsPath: string, name: string): Promise<void> {
  await rm(jobPath(wsPath, name))
  await rm(runsPath(wsPath, name), { force: true })
}

/** Ask the scheduler to run a job now (picked up on its next scan). */
export async function requestRun(wsPath: string, name: string): Promise<void> {
  await readJob(wsPath, name)
  const dir = path.join(wsPath, TRIGGER_DIR)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), new Date().toISOString())
}

export function errorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'job'}: ${i.message}`).join('; ')
  }
  return err instanceof Error ? err.message : String(err)
}
