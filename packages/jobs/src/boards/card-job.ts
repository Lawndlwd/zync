import { readFile } from 'node:fs/promises'

import { badRequest } from '../errors.js'
import { localStamp } from '../helpers/dates.js'
import { deleteJob, type Job, jobPath, nextRuns, requestRun, serializeJob, validateJob, writeJob } from '../job-file.js'
import { readBoardMeta } from './board-file.js'
import { applyPatch, readCard, writeCard } from './card-io.js'
import { cardJobName, cardRef } from './refs.js'
import { AI_ASSIGNEE, type Board, type Card } from './types.js'

export function cardJobInstructions(board: Board, card: Card): string {
  return [
    `You are working on the kanban card "${card.title}" (board "${board.name}", file ${cardRef(board.path, card.file)}).`,
    'Do not edit the card file: the board is updated automatically when you finish.',
    '',
    card.description || card.title,
  ].join('\n')
}

/**
 * Make the card's linked job match the card: an "ai" card with a run time has a one-shot job,
 * anything else has none. Returns the card with `ai` updated (caller writes it).
 */
export async function syncCardJob(wsPath: string, board: Board, card: Card, opts: { at?: string } = {}): Promise<Card> {
  const at = opts.at ?? card.runAt
  const ref = cardRef(board.path, card.file)
  const name = cardJobName(ref)

  if (card.assignee !== AI_ASSIGNEE || !at) {
    await deleteJob(wsPath, name).catch(() => {})
    return card.ai?.state === 'scheduled' ? { ...card, ai: undefined } : card
  }

  const job: Job = validateJob({
    name,
    at,
    card: ref,
    context: card.context,
    notify: 'always',
    enabled: true,
    instructions: cardJobInstructions(board, card),
  })
  const existing = await readFile(jobPath(wsPath, name), 'utf8').catch(() => null)
  // Rewriting an unchanged job would bump its mtime and make the scheduler re-register it for nothing.
  if (existing === serializeJob(job)) return card
  await writeJob(wsPath, job, { overwrite: true })
  if (card.ai?.state !== 'running' && nextRuns(job, 1).length) return { ...card, ai: { state: 'scheduled' } }
  return card
}

/**
 * Assign to @ai (if not already) and run immediately. Clears any pending run time so the card
 * doesn't run a second time later.
 */
export async function runCardNow(wsPath: string, boardPath: string, file: string): Promise<Card> {
  const board = await readBoardMeta(wsPath, boardPath)
  let card = applyPatch(await readCard(wsPath, board.path, file), { assignee: AI_ASSIGNEE, runAt: null })
  if (card.ai?.state === 'running') throw badRequest('This card is already running')
  card = await syncCardJob(wsPath, board, card, { at: localStamp() })
  await requestRun(wsPath, cardJobName(cardRef(board.path, card.file)))
  card = { ...card, ai: { state: 'scheduled' } }
  await writeCard(wsPath, board.path, card)
  return card
}
