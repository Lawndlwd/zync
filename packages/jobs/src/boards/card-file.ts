import path from 'node:path'

import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { type Card, CARD_FIELDS, isCardField } from './types.js'

/** Lenient: any markdown file is a card. Invalid fields are kept in `extra`, never dropped. */
export function parseCard(file: string, source: string): Card {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = parseFrontmatter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    // Broken YAML: show the whole file as the description rather than hiding the card.
  }
  const card: Card = {
    file,
    title: path.basename(file, '.md'),
    labels: [],
    context: [],
    description: content.trim(),
    extra: {},
  }
  // Older cards used `column`.
  if (data.status === undefined && data.column !== undefined) {
    data.status = data.column
    delete data.column
  }
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const r = isCardField(k) ? CARD_FIELDS[k].safeParse(v) : undefined
    if (r?.success) fields[k] = r.data
    else card.extra[k] = v
  }
  return Object.assign(card, fields)
}

export function serializeCard(card: Card): string {
  const meta: Record<string, unknown> = {}
  for (const k of Object.keys(CARD_FIELDS).filter(isCardField)) {
    const v = card[k]
    if (v === undefined || (Array.isArray(v) && v.length === 0)) continue
    meta[k] = v
  }
  for (const [k, v] of Object.entries(card.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return stringifyFrontmatter(meta, card.description)
}
