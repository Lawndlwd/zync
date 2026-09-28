import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { parseJson } from './helpers/json.js'
import { JOBS_DIR } from './job-file.js'

// A job running right now, as a small file the scheduler writes when it starts a run and removes
// when the run ends: <ws>/.opencode/jobs/.running/<name>.json. The scheduler is its own process;
// this is how the api (and so the app) knows a run is in progress and which AI session to watch.

export const RUNNING_DIR = path.join(JOBS_DIR, '.running')

const ActiveRunSchema = z.object({
  sessionId: z.string(),
  /** ISO date-time. */
  started: z.string(),
  trigger: z.enum(['schedule', 'manual']),
})
export type ActiveRun = z.infer<typeof ActiveRunSchema>

const fileOf = (wsPath: string, name: string) => path.join(wsPath, RUNNING_DIR, `${path.basename(name)}.json`)

export async function markRunning(wsPath: string, name: string, run: ActiveRun): Promise<void> {
  await mkdir(path.join(wsPath, RUNNING_DIR), { recursive: true })
  await writeFile(fileOf(wsPath, name), `${JSON.stringify(run)}\n`)
}

export async function clearRunning(wsPath: string, name: string): Promise<void> {
  await rm(fileOf(wsPath, name), { force: true })
}

/** Forget every run of a workspace: the scheduler starting again has none in progress. */
export async function clearAllRunning(wsPath: string): Promise<void> {
  await rm(path.join(wsPath, RUNNING_DIR), { recursive: true, force: true })
}

/** The run in progress, or null (also for a missing or unreadable file). */
export async function readRunning(wsPath: string, name: string): Promise<ActiveRun | null> {
  const src = await readFile(fileOf(wsPath, name), 'utf8').catch(() => null)
  const r = ActiveRunSchema.safeParse(src === null ? null : parseJson(src))
  return r.success ? r.data : null
}
