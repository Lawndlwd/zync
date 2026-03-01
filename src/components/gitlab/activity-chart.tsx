import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TimeDataPoint } from '@/lib/gitlab-stats'

const chartConfig = {
  created: { label: 'Created', color: 'var(--color-indigo-500)' },
  merged: { label: 'Merged', color: 'var(--color-emerald-500)' },
} satisfies ChartConfig

interface ActivityChartProps {
  data: TimeDataPoint[]
}

export function GitLabActivityChart({ data }: ActivityChartProps) {
  if (data.every((d) => d.created === 0 && d.merged === 0)) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 flex items-center justify-center h-48">
        <p className="text-sm text-zinc-500">No activity in this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-xs font-medium text-zinc-400 mb-3">Activity</p>
      <ChartContainer config={chartConfig} className="h-48 w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-zinc-500)', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--color-zinc-500)', fontSize: 10 }}
            width={30}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="created" fill="var(--color-indigo-500)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="merged" fill="var(--color-emerald-500)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
