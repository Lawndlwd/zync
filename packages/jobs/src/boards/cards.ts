import { rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '../errors.js'
import { freeFileName } from '../helpers/files.js'
import { deleteJob } from '../job-file.js'
import { readBoardMeta } from './board-file.js'
import { applyPatch, listCards, readCard, writeCard } from './card-io.js'
import { syncCardJob } from './card-job.js'
import { boardDir, cardJobName, cardRef } from './refs.js'
import { type Board, type Card, type CardPatch, CARD_FIELDS, firstColumn } from './types.js'

function assertColumn(board: Board, status: string | undefined): void {
  if (status && !board.columns.some((c) => c.id === status)) {
    throw badRequest(`Board "${board.name}" has no column "${status}"`)
  }
}

export async function createCard(
  wsPath: string,
  boardPath: string,
  input: CardPatch & { title: string },
): Promise<Card> {
  const board = await readBoardMeta(wsPath, boardPath)
  const cards = await listCards(wsPath, board.path)
  const dir = await boardDir(wsPath, board.path)
  const first = firstColumn(board)
  const status = input.status ?? first
  assertColumn(board, status)
  const ordered = cards.filter((c) => (c.status ?? first) === status && c.order !== undefined)
  const order = input.order ?? (ordered.length ? Math.max(...ordered.map((c) => c.order ?? 0)) + 1 : 0)
  const title = CARD_FIELDS.title.parse(input.title)
  const blank: Card = {
    file: await freeFileName(dir, title),
    title,
    labels: [],
    context: [],
    description: '',
    extra: {},
  }
  let card = applyPatch(blank, { ...input, title, status, order })
  card = await syncCardJob(wsPath, board, card)
  await writeCard(wsPath, board.path, card)
  return card
}

export async function updateCard(wsPath: string, boardPath: string, file: string, patch: CardPatch): Promise<Card> {
  const board = await readBoardMeta(wsPath, boardPath)
  const current = await readCard(wsPath, board.path, file)
  let card = applyPatch(current, patch)
  assertColumn(board, card.status)
  // The file name follows the title.
  if (card.title !== current.title) {
    const dir = await boardDir(wsPath, board.path)
    const nextFile = await freeFileName(dir, card.title, current.file)
    if (nextFile !== current.file) {
      await deleteJob(wsPath, cardJobName(cardRef(board.path, current.file))).catch(() => {})
      await rename(path.join(dir, current.file), path.join(dir, nextFile))
      card = { ...card, file: nextFile }
    }
  }
  card = await syncCardJob(wsPath, board, card)
  await writeCard(wsPath, board.path, card)
  return card
}

export async function deleteCard(wsPath: string, boardPath: string, file: string): Promise<void> {
  const board = await readBoardMeta(wsPath, boardPath)
  await readCard(wsPath, board.path, file)
  await deleteJob(wsPath, cardJobName(cardRef(board.path, file))).catch(() => {})
  await rm(path.join(await boardDir(wsPath, board.path), file))
}
