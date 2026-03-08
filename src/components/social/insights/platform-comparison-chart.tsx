import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'

const platformColors: Record<string, string> = {
  instagram: '#ec4899',
  x: '#0ea5e9',
  youtube: '#ef4444',
}

const chartConfig = {
  avg_engagement_rate: { label: 'Avg Engagement Rate' },
} satisfies ChartConfig

interface Props {
  data: Array<{
    platform: string
    avg_engagement_rate: number
    total_reach: number
    total_posts: number
  }>
}

export function PlatformComparisonChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No cross-platform data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Platform Comparison</p>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="platform"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `${Number(value).toFixed(2)}%`}
              />
            }
          />
          <Bar dataKey="avg_engagement_rate" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={platformColors[entry.platform.toLowerCase()] ?? '#6366f1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
