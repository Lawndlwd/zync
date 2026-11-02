import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** One workout of Training/Log/, in progress or finished. */
export function useWorkout(ws: string, file: string) {
  return useQuery({
    queryKey: ['training', ws, 'workout', file],
    queryFn: () => api.workout(ws, file),
    enabled: !!ws && !!file,
  })
}
