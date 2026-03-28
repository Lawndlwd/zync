import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { LiveSessions } from '@/components/activity/live-sessions'
import { SourceBreakdown } from '@/components/activity/source-breakdown'
import { StatsCards } from '@/components/activity/stats-cards'
import { UsageChart } from '@/components/activity/usage-chart'
import { fetchActivityStats } from '@/services/activity'

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
          <h1 className="text-2xl font-display font-bold text-foreground">AI Activity</h1>
          <p className="text-base text-muted-foreground">Track AI usage, tokens, and costs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  source === opt.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TIME_RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  days === d ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-border bg-secondary p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No usage data yet</h2>
          <p className="text-sm text-muted-foreground">
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
