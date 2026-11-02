import { useQuery } from '@tanstack/react-query'

import { api, ApiError } from '../api'

/** A week's Mirror page (Becoming/Mirror/<week>.md); `data` is null when it isn't written yet. */
export function useMirror(ws: string, week: string) {
  return useQuery({
    queryKey: ['becoming', ws, 'mirror', week],
    queryFn: () =>
      api.mirror(ws, week).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }),
    enabled: !!ws && !!week,
  })
}
