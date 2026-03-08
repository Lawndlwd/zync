import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface FollowerGrowthChartProps {
  data: Array<{ date: string; followers: number }>
  prevData?: Array<{ date: string; followers: number }>
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = dateStr.length === 10 ? new Date(dateStr + 'T00:00:00') : new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatCompact(n: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n)
}

export function FollowerGrowthChart({ data, prevData }: FollowerGrowthChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-400 mb-3">Follower Growth</p>
        <p className="text-sm text-zinc-500">No data</p>
      </div>
    )
  }

  const chartConfig: ChartConfig = {
    followers: { label: 'Followers', color: '#6366f1' },
    ...(prevData?.length ? { prev: { label: 'Previous Period', color: '#71717a' } } : {}),
  }

  // Merge current and previous data by index for charting
  const mergedData = data.map((d, i) => ({
    ...d,
    prev: prevData?.[i]?.followers,
  }))

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Follower Growth</p>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={mergedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval="equidistantPreserveStart"
            minTickGap={30}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {prevData?.length && (
            <Line
              type="monotone"
              dataKey="prev"
              stroke="var(--color-prev)"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              opacity={0.5}
              dot={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="followers"
            stroke="var(--color-followers)"
            strokeWidth={2}
            fill="url(#followerGrad)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
