import { useQuery } from '@tanstack/react-query'
import { api, type Board, type Card, type CardPatch } from '../api'
import { wsUrl } from '../shell/context'

export function usePeople() {
  return useQuery({ queryKey: ['people'], queryFn: api.people }).data ?? []
}

/** URL path for a board folder (each segment encoded). */
export const boardUrl = (ws: string, boardPath: string) =>
  wsUrl(ws, `boards/${boardPath.split('/').map(encodeURIComponent).join('/')}`)

export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'col'
  )
}

/** Strip nulls so an optimistic update matches what the server will return. */
export function applyLocal(card: Card, patch: CardPatch): Card {
  const next: Record<string, unknown> = { ...card }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k]
    else if (v !== undefined) next[k] = v
  }
  return next as unknown as Card
}

/** The column a card is shown in: its status, or the first column when unknown. */
export const statusOf = (board: Board, c: Card) =>
  c.status && board.columns.some((col) => col.id === c.status) ? c.status : board.columns[0].id

export const doneColumn = (board: Board) => board.columns[board.columns.length - 1]?.id

export const sessionUrl = (ws: string, sessionId: string) => wsUrl(ws, `chat?session=${encodeURIComponent(sessionId)}`)
