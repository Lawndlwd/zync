import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import { estimateCost } from '@/lib/cost'

interface ModelBreakdownProps {
  days: number
}

export function ModelBreakdown({ days }: ModelBreakdownProps) {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
  })

  const models = stats?.byModel ?? []

  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No data yet</p>
      </div>
    )
  }

  const maxTokens = Math.max(...models.map((m) => m.total_tokens), 1)

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-zinc-300 mb-4">Per-Model Breakdown</p>
      <div className="space-y-3">
        {models.map((m) => {
          const cost = estimateCost(m.model, m.prompt_tokens, m.completion_tokens)
          const pct = (m.total_tokens / maxTokens) * 100
          return (
            <div key={m.model}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-300 font-medium truncate">{m.model}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
                  <span>{m.calls} calls</span>
                  <span>{formatTokens(m.total_tokens)} tokens</span>
                  {cost !== null && cost > 0 && <span>${cost.toFixed(4)}</span>}
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06]">
                <div
                  className="h-2 rounded-full bg-indigo-500/60"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
