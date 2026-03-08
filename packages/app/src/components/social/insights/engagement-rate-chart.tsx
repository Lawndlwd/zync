import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface EngagementRateChartProps {
  data: Array<{ date: string; rate: number }>
}

const chartConfig: ChartConfig = {
  rate: { label: 'Engagement Rate', color: '#10b981' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = dateStr.length === 10 ? new Date(dateStr + 'T00:00:00') : new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function EngagementRateChart({ data }: EngagementRateChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-400 mb-3">Engagement Rate</p>
        <p className="text-sm text-zinc-500">No data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Engagement Rate</p>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="engRateGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
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
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--color-rate)"
            strokeWidth={2}
            fill="url(#engRateGrad)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
