import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { addDays } from '../helpers/dates.js'
import { parseJson } from '../helpers/json.js'
import { becomingDir } from './store.js'
import { type DayVote, type Identity, type Vote, VoteSchema, VOTES_FILE } from './types.js'

/** Every vote recorded, oldest first. Unreadable lines are skipped. */
export async function readVotes(wsPath: string): Promise<Vote[]> {
  const src = await readFile(path.join(await becomingDir(wsPath), VOTES_FILE), 'utf8').catch(() => '')
  const out: Vote[] = []
  for (const line of src.split('\n')) {
    if (!line.trim()) continue
    const r = VoteSchema.safeParse(parseJson(line))
    if (r.success) out.push(r.data)
  }
  return out
}

export async function appendVote(wsPath: string, vote: Omit<Vote, 'at'>): Promise<Vote> {
  const full = VoteSchema.parse({ ...vote, at: new Date().toISOString() })
  const dir = await becomingDir(wsPath)
  await mkdir(dir, { recursive: true })
  await appendFile(path.join(dir, VOTES_FILE), `${JSON.stringify(full)}\n`)
  return full
}

export const voteKey = (date: string, identity: string) => `${date}|${identity}`

/**
 * The standing vote per (day, identity): the last line wins, "clear" removes it. A vote the user
 * cast (tap, palette…) is never replaced by a later automatic one.
 */
export function standingVotes(votes: Vote[]): Map<string, DayVote> {
  const out = new Map<string, DayVote>()
  for (const v of votes) {
    const key = voteKey(v.date, v.identity)
    if (v.kind === 'clear') {
      out.delete(key)
      continue
    }
    const was = out.get(key)
    if (v.source === 'auto' && was && was.source !== 'auto') continue
    out.set(key, { kind: v.kind, source: v.source, ...(v.note ? { note: v.note } : {}) })
  }
  return out
}

export type StripCell = 'full' | 'small' | 'none' | 'before'

/** The last `days` days up to `end` (inclusive), oldest first: a heat strip. */
export function strip(votes: Map<string, DayVote>, identity: Identity, end: string, days = 28): StripCell[] {
  const cells: StripCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i)
    if (identity.since && date < identity.since) cells.push('before')
    else cells.push(votes.get(voteKey(date, identity.file))?.kind ?? 'none')
  }
  return cells
}
