import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'

// A Training record is a markdown page: frontmatter we manage, plus any key someone else added (the
// user, the AI), which is kept as-is on every write.

export type RecordPage = { data: Record<string, unknown>; body: string }

/** A page's frontmatter and body; null when the file doesn't exist. Broken YAML reads as all body. */
export async function readRecord(file: string): Promise<RecordPage | null> {
  const src = await readFile(file, 'utf8').catch(() => null)
  if (src === null) return null
  try {
    const parsed = parseFrontmatter(src)
    return { data: { ...parsed.data }, body: parsed.content.trim() }
  } catch {
    return { data: {}, body: src.trim() }
  }
}

/**
 * Write `fields` (undefined = remove) over the page's current frontmatter; keys we don't manage stay.
 * `fields` come first, in their order.
 */
export async function writeRecord(file: string, fields: Record<string, unknown>, body: string): Promise<void> {
  const current = await readRecord(file)
  const data: Record<string, unknown> = {}
  // Through JSON: YAML can't dump the `undefined` optional fields leave inside arrays.
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) data[k] = JSON.parse(JSON.stringify(v)) as unknown
  for (const [k, v] of Object.entries(current?.data ?? {})) if (!(k in fields) && v !== undefined) data[k] = v
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, stringifyFrontmatter(data, body.trim()))
}
