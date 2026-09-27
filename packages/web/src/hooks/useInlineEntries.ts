import { useQuery } from '@tanstack/react-query'

import { api } from '../api'

/** Agents and commands written inside opencode.json itself (not files), listed for completeness. */
export function useInlineEntries() {
  const { data } = useQuery({ queryKey: ['opencode-config'], queryFn: api.opencodeConfig, staleTime: 30_000 })
  try {
    const cfg: Record<string, Record<string, { description?: string }>> = JSON.parse(data?.content ?? '{}')
    return {
      agent: Object.entries(cfg.agent ?? {}).map(([name, v]) => ({ name, description: v.description })),
      command: Object.entries(cfg.command ?? {}).map(([name, v]) => ({ name, description: v.description })),
      skill: [] as Array<{ name: string; description?: string }>,
    }
  } catch {
    return { agent: [], command: [], skill: [] }
  }
}
