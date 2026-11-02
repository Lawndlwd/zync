import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { asUtc } from '../helpers/dates.js'
import { parseJson } from '../helpers/json.js'
import { activityPath } from '../helpers/paths.js'
import { type Activity, ActivitySchema, BECOMING_DIR } from './types.js'

// What the user worked on and when, one JSON line per file per minute. Written by the scheduler's
// recorder (always running, unlike the browser's live-events watcher), read to find evidence.

/** Top-level folders that are Zync's own output, not the user's work. */
const NOT_WORK = new Set([BECOMING_DIR, 'Briefs'])
const SKIP = new Set(['node_modules', 'dist', 'build'])

/** Whether an edit to this workspace-relative path is the user's work. */
export function isWorkPath(rel: string): boolean {
  const parts = rel.split('/')
  if (parts.some((p) => p.startsWith('.') || SKIP.has(p))) return false
  return !NOT_WORK.has(parts[0] ?? '')
}

export async function appendActivity(wsPath: string, lines: Activity[]): Promise<void> {
  if (lines.length === 0) return
  const file = activityPath(wsPath)
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(''))
}

/** Activity with `from <= t < to` (local "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM"), oldest first. */
export async function readActivity(wsPath: string, from: string, to: string): Promise<Activity[]> {
  const src = await readFile(activityPath(wsPath), 'utf8').catch(() => '')
  const out: Activity[] = []
  for (const line of src.split('\n')) {
    if (!line.trim()) continue
    const r = ActivitySchema.safeParse(parseJson(line))
    if (r.success && r.data.t >= from && r.data.t < to) out.push(r.data)
  }
  return out.toSorted((a, b) => a.t.localeCompare(b.t))
}

export type Session = { start: string; end: string; minutes: number; files: string[] }

/** Edits closer than this belong to the same working session. */
const GAP_MINUTES = 10
/** A session with a single save still took some time. */
const MIN_SESSION = 5

const minutesBetween = (a: string, b: string) => (asUtc(b).getTime() - asUtc(a).getTime()) / 60_000

/** Group edits into working sessions; each file listed once, most edited first. */
export function sessions(edits: Activity[]): Session[] {
  const out: Session[] = []
  let current: { start: string; end: string; counts: Map<string, number> } | undefined
  const close = () => {
    if (!current) return
    const files = [...current.counts.entries()].toSorted((a, b) => b[1] - a[1]).map(([f]) => f)
    const minutes = Math.max(MIN_SESSION, minutesBetween(current.start, current.end) + MIN_SESSION)
    out.push({ start: current.start, end: current.end, minutes, files })
  }
  for (const e of edits.toSorted((a, b) => a.t.localeCompare(b.t))) {
    if (current && minutesBetween(current.end, e.t) <= GAP_MINUTES) {
      current.end = e.t
      current.counts.set(e.path, (current.counts.get(e.path) ?? 0) + 1)
    } else {
      close()
      current = { start: e.t, end: e.t, counts: new Map([[e.path, 1]]) }
    }
  }
  close()
  return out
}
