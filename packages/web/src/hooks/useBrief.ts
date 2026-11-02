import { useQuery } from '@tanstack/react-query'

import { api, ApiError } from '../api'

/** A day's brief (Briefs/<date>.md); `data` is null when there is none. */
export function useBrief(ws: string, date: string) {
  return useQuery({
    queryKey: ['briefs', ws, date],
    queryFn: () =>
      api.brief(ws, date).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }),
    enabled: !!ws,
  })
}
