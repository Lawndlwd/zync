import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '../api'
import type { ExerciseQuery } from '../types/training'

/** One page of the exercise library; the previous page stays on screen while the next loads. */
export function useExercises(ws: string, query: ExerciseQuery, limit = 30) {
  return useQuery({
    queryKey: ['training', ws, 'exercises', query.q, query.muscle, query.equipment, query.offset, limit],
    queryFn: ({ signal }) => api.exercises(ws, query, limit, signal),
    enabled: !!ws,
    placeholderData: keepPreviousData,
  })
}
