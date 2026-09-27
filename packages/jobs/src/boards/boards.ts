import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { badRequest } from '../errors.js'
import { exists } from '../helpers/files.js'
import { safeName } from '../helpers/names.js'
import { deleteJob } from '../job-file.js'
import { readBoardMeta, writeBoardFile } from './board-file.js'
import { listCards, writeCard } from './card-io.js'
import { syncCardJob } from './card-job.js'
import { boardDir, cardJobName, cardRef, cleanBoardPath } from './refs.js'
import {
  type Board,
  BOARD_FILE,
  BoardFileSchema,
  type Card,
  type Column,
  DEFAULT_COLUMNS,
  firstColumn,
} from './types.js'

/** Create a board folder, or turn an existing folder into a board. */
export async function createBoard(
  wsPath: string,
  input: { name: string; parent?: string; columns?: Column[] },
): Promise<Board> {
  const name = safeName(input.name)
  const rel = input.parent ? `${cleanBoardPath(input.parent)}/${name}` : name
  const dir = await boardDir(wsPath, rel)
  if (await exists(path.join(dir, BOARD_FILE))) throw badRequest(`"${rel}" is already a board`)
  const parsed = BoardFileSchema.safeParse({ columns: input.columns ?? DEFAULT_COLUMNS })
  if (!parsed.success) throw badRequest(`Invalid columns: ${parsed.error.issues[0]?.message}`)
  const { columns } = parsed.data
  await mkdir(dir, { recursive: true })
  await writeBoardFile(dir, columns)
  return { path: rel, name, columns }
}

export async function readBoard(wsPath: string, boardPath: string): Promise<{ board: Board; cards: Card[] }> {
  const board = await readBoardMeta(wsPath, boardPath)
  return { board, cards: await listCards(wsPath, board.path) }
}

/** Rename (moves the folder) and/or change columns. */
export async function updateBoard(
  wsPath: string,
  boardPath: string,
  patch: { name?: string; columns?: Column[] },
): Promise<Board> {
  let board = await readBoardMeta(wsPath, boardPath)
  if (patch.columns) {
    const kept = new Set(patch.columns.map((c) => c.id))
    const first = firstColumn(board)
    const orphans = (await listCards(wsPath, board.path)).filter((c) => !kept.has(c.status ?? first))
    if (orphans.length) throw badRequest(`Move the ${orphans.length} card(s) out of the removed column(s) first`)
    await writeBoardFile(await boardDir(wsPath, board.path), patch.columns)
    board = { ...board, columns: patch.columns }
  }
  if (patch.name !== undefined && safeName(patch.name) !== board.name) {
    const parent = path.posix.dirname(board.path)
    const rel = parent === '.' ? safeName(patch.name) : `${parent}/${safeName(patch.name)}`
    const to = await boardDir(wsPath, rel)
    if (await exists(to)) throw badRequest(`"${rel}" already exists`)
    const cards = await listCards(wsPath, board.path)
    for (const c of cards) await deleteJob(wsPath, cardJobName(cardRef(board.path, c.file))).catch(() => {})
    await rename(await boardDir(wsPath, board.path), to)
    board = { ...board, path: rel, name: path.posix.basename(rel) }
    // Job names derive from the card path, so re-link them under the new folder.
    for (const c of cards) {
      const synced = await syncCardJob(wsPath, board, c)
      if (synced !== c) await writeCard(wsPath, board.path, synced)
    }
  }
  return board
}

/** Stop treating the folder as a board. The card files stay where they are. */
export async function deleteBoard(wsPath: string, boardPath: string): Promise<void> {
  const board = await readBoardMeta(wsPath, boardPath)
  for (const card of await listCards(wsPath, board.path)) {
    await deleteJob(wsPath, cardJobName(cardRef(board.path, card.file))).catch(() => {})
  }
  await rm(path.join(await boardDir(wsPath, board.path), BOARD_FILE), { force: true })
}
