import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid } from 'recharts'

const chartConfig = {
  count: { label: 'Posts', color: '#6366f1' },
  avg_engagement_rate: { label: 'Eng. Rate', color: '#10b981' },
} satisfies ChartConfig

interface Props {
  data: Array<{ week: string; count: number; avg_engagement_rate: number }>
}

export function PostFrequencyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No post frequency data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Post Frequency</p>
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={(v: string) => v.replace(/^\d{4}-/, '')}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval="equidistantPreserveStart"
            minTickGap={30}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            yAxisId="left"
            dataKey="count"
            fill="#6366f1"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avg_engagement_rate"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
