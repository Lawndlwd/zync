import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** Accounts connected in Settings → Connections, and which providers this server can connect. */
export function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: api.connections })
}
