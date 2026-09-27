import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '../api'

/** Paths offered as AI context: every known file plus the folders they live in. */
export function useContextSuggestions(ws: string): string[] {
  const { data } = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) })
  return useMemo(() => {
    const out = new Set<string>()
    for (const f of data?.entries ?? []) {
      const parts = f.path.split('/')
      for (let i = 1; i < parts.length; i++) out.add(`${parts.slice(0, i).join('/')}/`)
    }
    for (const f of data?.entries ?? []) out.add(f.path)
    return [...out]
  }, [data])
}
