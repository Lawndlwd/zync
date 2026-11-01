import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** A day seen through the user's identities: day mode, targets, slots, votes, the one card. */
export function useBecomingToday(ws: string, date: string) {
  return useQuery({
    queryKey: ['becoming', ws, 'today', date],
    queryFn: () => api.becomingToday(ws, date),
    enabled: !!ws,
  })
}
