import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** Every routine in Training/Routines/. */
export function useRoutines(ws: string) {
  return useQuery({ queryKey: ['training', ws, 'routines'], queryFn: () => api.routines(ws), enabled: !!ws })
}
