import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchActivityStats } from '@/services/activity'
import { Section } from './section'
import { StatBlock } from './stat-block'

const periodOptions = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 9999 },
] as const

const tooltipStyle = {
  contentStyle: {
    background: 'var(--card)',
    border: 'none',
    borderRadius: '1rem',
    fontSize: 12,
    boxShadow: '0 0 3rem rgba(0,0,0,0.04)',
  },
  labelStyle: { color: 'var(--muted-foreground)' },
  cursor: { fill: 'var(--secondary)' },
}

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

export function ActivitySection() {
  const [days, setDays] = useState(7)
  const periodLabel = periodOptions.find((p) => p.days === days)?.label ?? `${days}d`

  const { data: stats, isLoading } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
    retry: 1,
  })

  const rawDays = days <= 90 ? stats?.byDay : stats?.byDay.slice(-90)
  const barData = rawDays?.map((d) => ({
    ...d,
    tokens: d.prompt_tokens + d.completion_tokens,
  }))

  return (
    <Section icon={Activity} iconColor="text-primary" title="AI Activity" to="" className="col-span-12 lg:col-span-9">
      <div className="flex gap-1 mb-4">
        {periodOptions.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              days === p.days
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : stats ? (
        <>
          <div className="flex items-center gap-3 mb-5 rounded-2xl bg-secondary py-4">
            <StatBlock label="Today" value={stats.callsToday} color="text-primary" />
            <div className="w-px h-8 bg-border" />
            <StatBlock label={`${periodLabel} Calls`} value={stats.totals.total_calls} color="text-foreground" />
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-2xl font-bold text-foreground">{formatTokens(stats.totals.total_tokens)}</span>
              <span className="text-sm text-muted-foreground">{periodLabel} Tokens</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-2xl font-bold text-foreground">${stats.totals.total_cost?.toFixed(2) ?? '0'}</span>
              <span className="text-sm text-muted-foreground">{periodLabel} Cost</span>
            </div>
          </div>

          {barData && barData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Calls per day</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.floor(barData.length / 5) - 1)}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={35}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      itemStyle={{ color: '#b91f02' }}
                      formatter={(value: number) => [value, 'Calls']}
                    />
                    <Bar dataKey="calls" fill="#b91f0280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Tokens per day</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.floor(barData.length / 5) - 1)}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={45}
                      tickFormatter={formatTokens}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      itemStyle={{ color: '#ff5737' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
                    />
                    <Bar dataKey="tokens" fill="#ff573780" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No activity data</p>
      )}
    </Section>
  )
}
