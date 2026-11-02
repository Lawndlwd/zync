import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** The workspace's identity pages (Becoming/): their guards reach the whole app. */
export function useIdentities(ws: string) {
  return useQuery({ queryKey: ['becoming', ws, 'identities'], queryFn: () => api.identities(ws), enabled: !!ws })
}
