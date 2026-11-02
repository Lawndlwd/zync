import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '../api'
import type { ProgressRange } from '../types/training'

/** Volume per week or month, e1RM records and the body-weight trend over a range. */
export function useTrainingProgress(ws: string, range: ProgressRange) {
  return useQuery({
    queryKey: ['training', ws, 'progress', range],
    queryFn: () => api.trainingProgress(ws, range),
    enabled: !!ws,
    placeholderData: keepPreviousData,
  })
}
