import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface ReachImpressionsChartProps {
  data: Array<{ date: string; reach: number; impressions: number }>
}

const chartConfig: ChartConfig = {
  reach: { label: 'Reach', color: '#6366f1' },
  impressions: { label: 'Impressions', color: '#d946ef' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  // Handle both "YYYY-MM-DD" and full ISO strings
  const d = dateStr.length === 10 ? new Date(dateStr + 'T00:00:00') : new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCompact(n: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n)
}

export function ReachImpressionsChart({ data }: ReachImpressionsChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-400 mb-3">Reach & Impressions</p>
        <p className="text-sm text-zinc-500">No data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Reach & Impressions</p>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#d946ef" stopOpacity={0} />
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
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            type="monotone"
            dataKey="reach"
            stroke="var(--color-reach)"
            strokeWidth={2}
            fill="url(#reachGrad)"
          />
          <Area
            type="monotone"
            dataKey="impressions"
            stroke="var(--color-impressions)"
            strokeWidth={2}
            fill="url(#impressionsGrad)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
