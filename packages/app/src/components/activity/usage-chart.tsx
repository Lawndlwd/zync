import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

const chartConfig = {
  dashboard: { label: 'Dashboard', color: 'var(--color-indigo-500)' },
  opencode: { label: 'OpenCode', color: 'var(--color-emerald-500)' },
} satisfies ChartConfig

interface UsageChartProps {
  days: number
  source?: string
}

export function UsageChart({ days, source }: UsageChartProps) {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
  })

  const chartData = useMemo(() => {
    const byDaySource = stats?.byDaySource ?? []
    if (byDaySource.length === 0) return []

    const dayMap = new Map<string, { day: string; dashboard: number; opencode: number }>()

    for (const row of byDaySource) {
      if (source && source !== 'all' && row.source !== source) continue
      const entry = dayMap.get(row.day) ?? { day: row.day, dashboard: 0, opencode: 0 }
      if (row.source === 'opencode') {
        entry.opencode += row.total_tokens
      } else {
        entry.dashboard += row.total_tokens
      }
      dayMap.set(row.day, entry)
    }

    return Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day))
  }, [stats, source])

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No data for this period</p>
      </div>
    )
  }

  const showBothSeries = !source || source === 'all'

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-zinc-300 mb-4">Token Usage Over Time</p>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" />
          <XAxis
            dataKey="day"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fill: 'var(--color-zinc-500)', fontSize: 12 }}
          />
          <YAxis tick={{ fill: 'var(--color-zinc-500)', fontSize: 12 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {(showBothSeries || source === 'dashboard') && (
            <Area
              type="monotone"
              dataKey="dashboard"
              stackId="1"
              fill="var(--color-indigo-500)"
              fillOpacity={0.3}
              stroke="var(--color-indigo-500)"
            />
          )}
          {(showBothSeries || source === 'opencode') && (
            <Area
              type="monotone"
              dataKey="opencode"
              stackId="1"
              fill="var(--color-emerald-500)"
              fillOpacity={0.3}
              stroke="var(--color-emerald-500)"
            />
          )}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
