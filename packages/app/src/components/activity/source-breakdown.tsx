import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'

interface SourceBreakdownProps {
  days: number
}

const SOURCE_LABELS: Record<string, string> = {
  chat: 'Chat',
  bot: 'Bot',
  schedule: 'Schedule',
  dashboard: 'Dashboard',
  opencode: 'OpenCode',
  'pr-agent': 'PR Agent',
  'code-review': 'Code Review',
}

const SOURCE_COLORS: Record<string, string> = {
  chat: 'bg-indigo-500',
  bot: 'bg-violet-500',
  schedule: 'bg-amber-500',
  dashboard: 'bg-indigo-500',
  opencode: 'bg-emerald-500',
  'pr-agent': 'bg-sky-500',
  'code-review': 'bg-rose-500',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function SourceBreakdown({ days }: SourceBreakdownProps) {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
  })

  const sources = stats?.bySource ?? []
  if (sources.length === 0) return null

  const maxTokens = Math.max(...sources.map((s) => s.total_tokens), 1)

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-zinc-300 mb-4">Usage by Source</p>
      <div className="space-y-3">
        {sources.map((s) => {
          const pct = (s.total_tokens / maxTokens) * 100
          const label = SOURCE_LABELS[s.source] ?? s.source
          const color = SOURCE_COLORS[s.source] ?? 'bg-zinc-500'
          return (
            <div key={s.source}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-300 font-medium">{label}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{s.calls} calls</span>
                  <span>{formatTokens(s.total_tokens)} tokens</span>
                  {s.cost > 0 && <span>${s.cost.toFixed(4)}</span>}
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06]">
                <div
                  className={`h-2 rounded-full ${color} opacity-60`}
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
