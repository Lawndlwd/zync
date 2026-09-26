import { appendFile, readFile } from 'node:fs/promises'
import { runsPath } from './job-file.js'

export type RunStatus = 'ok' | 'failed' | 'timeout' | 'skipped'

export interface RunRecord {
  ts: string
  sessionId?: string
  status: RunStatus
  durationMs?: number
  summary: string
  trigger: 'schedule' | 'manual'
}

export async function appendRun(wsPath: string, name: string, run: RunRecord): Promise<void> {
  await appendFile(runsPath(wsPath, name), `${JSON.stringify(run)}\n`)
}

/** Most recent first. */
export async function readRuns(wsPath: string, name: string, limit = 20): Promise<RunRecord[]> {
  const src = await readFile(runsPath(wsPath, name), 'utf8').catch(() => '')
  const runs: RunRecord[] = []
  for (const line of src.split('\n')) {
    if (!line.trim()) continue
    try {
      runs.push(JSON.parse(line))
    } catch {
      // skip corrupt line
    }
  }
  return runs.reverse().slice(0, limit)
}
