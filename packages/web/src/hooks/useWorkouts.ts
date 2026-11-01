import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** The workouts of one month ("YYYY-MM"), as summaries. */
export function useWorkouts(ws: string, month: string) {
  return useQuery({
    queryKey: ['training', ws, 'workouts', month],
    queryFn: ({ signal }) => api.workouts(ws, month, signal),
    enabled: !!ws,
    placeholderData: keepPreviousData,
  })
}
