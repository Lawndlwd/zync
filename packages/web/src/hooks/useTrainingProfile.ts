import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** Training/profile.md, or null before the setup was done. */
export function useTrainingProfile(ws: string) {
  return useQuery({ queryKey: ['training', ws, 'profile'], queryFn: () => api.trainingProfile(ws), enabled: !!ws })
}
