import path from 'node:path'

import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { safeName } from '../helpers/names.js'
import { type Memory, type MemoryScope, TypeSchema } from './types.js'

/** Accepts a title or a file name. */
export const memoryFile = (titleOrFile: string) => `${safeName(titleOrFile.trim().replace(/\.md$/i, ''))}.md`

export function parseMemory(file: string, source: string, scope: MemoryScope, updated: string): Memory {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = parseFrontmatter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    // Broken YAML: keep the whole file as the body.
  }
  const { type, description, pinned, ...extra } = data
  const t = TypeSchema.safeParse(type)
  if (type !== undefined && !t.success) extra.type = type
  return {
    file,
    title: path.basename(file, '.md'),
    scope,
    type: t.success ? t.data : undefined,
    description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
    pinned: pinned === true,
    updated,
    body: content.trim(),
    extra,
  }
}

export function serializeMemory(m: Pick<Memory, 'type' | 'description' | 'pinned' | 'body' | 'extra'>): string {
  const meta: Record<string, unknown> = {}
  if (m.type) meta.type = m.type
  if (m.description) meta.description = m.description
  if (m.pinned) meta.pinned = true
  for (const [k, v] of Object.entries(m.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  const body = m.body.trim() ? `\n${m.body.trim()}\n` : ''
  return Object.keys(meta).length ? stringifyFrontmatter(meta, m.body.trim()) : body.trimStart()
}
