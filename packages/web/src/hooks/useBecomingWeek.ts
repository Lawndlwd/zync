import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** A week's numbers as Zync sees them now (the Mirror before it is written). */
export function useBecomingWeek(ws: string, week: string, enabled = true) {
  return useQuery({
    queryKey: ['becoming', ws, 'week', week],
    queryFn: () => api.becomingWeek(ws, week),
    enabled: !!ws && !!week && enabled,
  })
}
