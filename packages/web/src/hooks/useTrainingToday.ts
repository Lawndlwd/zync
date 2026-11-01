import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** Today in Training: the planned routine, a workout in progress, the week and the streak. */
export function useTrainingToday(ws: string) {
  return useQuery({ queryKey: ['training', ws, 'today'], queryFn: () => api.trainingToday(ws), enabled: !!ws })
}
