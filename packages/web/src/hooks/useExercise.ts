import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** One exercise with the user's history and best set. */
export function useExercise(ws: string, id: string) {
  return useQuery({
    queryKey: ['training', ws, 'exercise', id],
    queryFn: () => api.exercise(ws, id),
    enabled: !!ws && !!id,
  })
}
