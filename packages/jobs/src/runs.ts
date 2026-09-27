import { appendFile, open } from 'node:fs/promises'

import { runsPath } from './job-file.js'

export type RunStatus = 'ok' | 'failed' | 'timeout' | 'skipped'

export type RunRecord = {
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

const CHUNK = 64 * 1024

/** Most recent first. Reads the log from its end, only as far back as `limit` runs need. */
export async function readRuns(wsPath: string, name: string, limit = 20): Promise<RunRecord[]> {
  const fh = await open(runsPath(wsPath, name), 'r').catch(() => null)
  if (!fh) return []
  try {
    const runs: RunRecord[] = []
    let pos = (await fh.stat()).size
    // Bytes of a line cut by the chunk boundary, completed by the next (earlier) chunk.
    let carry = Buffer.alloc(0)
    while (pos > 0 && runs.length < limit) {
      const size = Math.min(CHUNK, pos)
      pos -= size
      const buf = Buffer.alloc(size)
      await fh.read(buf, 0, size, pos)
      const text = Buffer.concat([buf, carry])
      // The first line may be cut (even mid-character), unless this chunk starts the file: keep its
      // bytes for the next round. Everything after the first newline is whole lines.
      let start = 0
      if (pos > 0) {
        const nl = text.indexOf(0x0a)
        carry = nl < 0 ? text : text.subarray(0, nl)
        if (nl < 0) continue
        start = nl + 1
      } else carry = Buffer.alloc(0)
      for (const line of text.subarray(start).toString('utf8').split('\n').toReversed()) {
        if (runs.length >= limit) break
        if (!line.trim()) continue
        try {
          runs.push(JSON.parse(line))
        } catch {
          // skip corrupt line
        }
      }
    }
    return runs
  } finally {
    await fh.close()
  }
}
