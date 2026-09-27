import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { notFound } from '../errors.js'
import { checkMdFile, listMdFiles } from '../helpers/files.js'
import { parseCard, serializeCard } from './card-file.js'
import { boardDir } from './refs.js'
import { type Card, type CardPatch, CARD_FIELDS, isCardField } from './types.js'

const ord = (c: Card) => c.order ?? Number.POSITIVE_INFINITY

/** Ordered cards first (by `order`), then the rest by title. */
export async function listCards(wsPath: string, boardPath: string): Promise<Card[]> {
  const dir = await boardDir(wsPath, boardPath)
  const cards: Card[] = []
  for (const file of await listMdFiles(dir)) {
    const src = await readFile(path.join(dir, file), 'utf8').catch(() => null)
    if (src !== null) cards.push(parseCard(file, src))
  }
  return cards.toSorted((a, b) => ord(a) - ord(b) || a.title.localeCompare(b.title))
}

export async function readCard(wsPath: string, boardPath: string, file: string): Promise<Card> {
  const dir = await boardDir(wsPath, boardPath)
  const src = await readFile(path.join(dir, checkMdFile(file, 'card')), 'utf8').catch(() => {
    throw notFound(`Unknown card "${file}" on board "${boardPath}"`)
  })
  return parseCard(file, src)
}

export async function writeCard(wsPath: string, boardPath: string, card: Card): Promise<void> {
  const dir = await boardDir(wsPath, boardPath)
  await writeFile(path.join(dir, checkMdFile(card.file, 'card')), serializeCard(card))
}

export function applyPatch(card: Card, patch: CardPatch): Card {
  const next: Card = { ...card }
  // Card is a plain object type, so it can be written field by field through this view.
  const fields: Record<string, unknown> = next
  for (const [k, v] of Object.entries(patch) as Array<[string, unknown]>) {
    if (v === undefined) continue
    if (k === 'description') {
      next.description = z.string().parse(v).trim()
      continue
    }
    if (!isCardField(k)) continue
    if (v === null) {
      if (k === 'labels' || k === 'context') fields[k] = []
      else delete fields[k]
    } else {
      fields[k] = CARD_FIELDS[k].parse(v)
    }
    // A field we now manage must not also linger in `extra`.
    if (k in next.extra) next.extra = Object.fromEntries(Object.entries(next.extra).filter(([e]) => e !== k))
  }
  return next
}
