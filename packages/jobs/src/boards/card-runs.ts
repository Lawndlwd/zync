import { stat } from 'node:fs/promises'
import path from 'node:path'

import { checkMdFile } from '../helpers/files.js'
import { readBoardMeta } from './board-file.js'
import { readCard, writeCard } from './card-io.js'
import { syncCardJob } from './card-job.js'
import { boardDir } from './refs.js'
import type { Card, CardRunEvent, Column } from './types.js'

/** Pure: where a card goes when its AI run starts or ends. */
export function cardAfterRun(card: Card, columns: Column[], event: CardRunEvent): Card {
  const move = (id: string) => (columns.some((c) => c.id === id) ? id : card.status)
  if (event.type === 'started') {
    return { ...card, status: move('doing'), ai: { state: 'running', sessionId: event.sessionId } }
  }
  const { run } = event
  if (run.status === 'skipped') return card
  const ok = run.status === 'ok'
  return {
    ...card,
    status: move(ok ? 'review' : 'todo'),
    ai: {
      state: ok ? 'done' : 'failed',
      sessionId: run.sessionId ?? card.ai?.sessionId,
      finishedAt: run.ts,
      summary: run.summary.slice(0, 2000),
    },
  }
}

/**
 * A card file was written directly (file editor, another tool): make its linked job match the file,
 * exactly as an edit through the card API would. No-op for files outside a board.
 */
export async function syncCardFile(wsPath: string, rel: string): Promise<void> {
  const boardPath = path.posix.dirname(rel)
  if (boardPath === '.' || !rel.endsWith('.md') || path.posix.basename(rel).startsWith('.')) return
  const board = await readBoardMeta(wsPath, boardPath).catch(() => null)
  if (!board) return
  const card = await readCard(wsPath, board.path, path.posix.basename(rel))
  const synced = await syncCardJob(wsPath, board, card)
  if (synced !== card) await writeCard(wsPath, board.path, synced)
}

/** Does the card a job points at still exist (on a board)? */
export async function cardExists(wsPath: string, ref: string): Promise<boolean> {
  try {
    const board = await readBoardMeta(wsPath, path.posix.dirname(ref))
    const s = await stat(path.join(await boardDir(wsPath, board.path), checkMdFile(path.posix.basename(ref), 'card')))
    return s.isFile()
  } catch {
    return false
  }
}

/** Apply a run event to the card a job points at ("<board path>/<file>.md"). No-op if it's gone. */
export async function applyCardRun(wsPath: string, ref: string, event: CardRunEvent): Promise<Card | null> {
  try {
    const board = await readBoardMeta(wsPath, path.posix.dirname(ref))
    const card = await readCard(wsPath, board.path, path.posix.basename(ref))
    const next = cardAfterRun(card, board.columns, event)
    await writeCard(wsPath, board.path, next)
    return next
  } catch {
    return null
  }
}
