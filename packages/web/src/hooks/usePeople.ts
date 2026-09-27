import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import type { Person } from '../types/people'

/** Everyone cards and events can be assigned to (global, shared by every workspace). */
export function usePeople(): Person[] {
  return useQuery({ queryKey: ['people'], queryFn: api.people }).data ?? []
}
