import { useQuery, useQueryClient } from '@tanstack/react-query'

export const PENDING_RESTART = ['opencode-pending-restart']

/** Mark that the running AI server doesn't have the latest setup yet. */
export function usePendingRestart(): [boolean, () => void] {
  const qc = useQueryClient()
  const { data = false } = useQuery({ queryKey: PENDING_RESTART, queryFn: () => false, staleTime: Infinity })
  return [data, () => qc.setQueryData(PENDING_RESTART, true)]
}
