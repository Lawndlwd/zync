import { useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import type { VoteKind } from '../types/becoming'

/** Cast (or undo) a vote for an identity, then refresh everything Becoming shows. */
export function useVote(ws: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return async (file: string, kind: VoteKind, source: 'tap' | 'palette' = 'tap', date?: string) => {
    try {
      await api.vote(ws, file, kind, date, source)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
    await qc.invalidateQueries({ queryKey: ['becoming', ws] })
  }
}
