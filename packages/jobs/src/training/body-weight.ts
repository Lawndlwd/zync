import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { localStamp } from '../helpers/dates.js'
import { parseJson } from '../helpers/json.js'
import { bodyPath } from './paths.js'
import { type BodyEntry, BodyEntrySchema, BodyInputSchema } from './types.js'

export type BodyWeight = { date: string; kg: number }

/** Log the body weight of a day (default today); a later entry for the same day replaces it. */
export async function addBodyWeight(
  wsPath: string,
  raw: { kg: number; date?: string | undefined },
): Promise<BodyEntry> {
  const input = BodyInputSchema.parse(raw)
  const entry = BodyEntrySchema.parse({
    date: input.date ?? localStamp().slice(0, 10),
    kg: input.kg,
    at: new Date().toISOString(),
  })
  const file = await bodyPath(wsPath)
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, `${JSON.stringify(entry)}\n`)
  return entry
}

/** One weight per day (the last entry wins), oldest first. Unreadable lines are skipped. */
export async function readBodyWeights(wsPath: string): Promise<BodyWeight[]> {
  const src = await readFile(await bodyPath(wsPath), 'utf8').catch(() => '')
  const byDay = new Map<string, number>()
  for (const line of src.split('\n')) {
    if (!line.trim()) continue
    const r = BodyEntrySchema.safeParse(parseJson(line))
    if (r.success) byDay.set(r.data.date, r.data.kg)
  }
  return [...byDay.entries()].map(([date, kg]) => ({ date, kg })).toSorted((a, b) => a.date.localeCompare(b.date))
}
