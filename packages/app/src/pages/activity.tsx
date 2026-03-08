import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import { StatsCards } from '@/components/activity/stats-cards'
import { UsageChart } from '@/components/activity/usage-chart'
import { SourceBreakdown } from '@/components/activity/source-breakdown'
import { LiveSessions } from '@/components/activity/live-sessions'
import { BarChart3 } from 'lucide-react'

const TIME_RANGES = [7, 14, 30] as const

type SourceFilter = 'all' | 'chat' | 'code-review'
const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'chat', label: 'Chat' },
  { value: 'code-review', label: 'Code Review' },
]

export function ActivityPage() {
  const [days, setDays] = useState<number>(7)
  const [source, setSource] = useState<SourceFilter>('all')

  const { data: stats } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
  })

  const hasData = stats && stats.totals.total_tokens > 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">AI Activity</h1>
          <p className="text-base text-zinc-500">Track AI usage, tokens, and costs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  source === opt.value
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
            {TIME_RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-zinc-700" />
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">No usage data yet</h2>
          <p className="text-sm text-zinc-500">
            Token usage will appear here as you use the AI chat or OpenCode.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <StatsCards days={days} source={source} />
          <UsageChart days={days} source={source} />
          <SourceBreakdown days={days} />
          <LiveSessions />
        </div>
      )}
    </div>
  )
}
