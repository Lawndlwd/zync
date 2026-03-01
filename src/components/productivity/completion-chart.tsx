import { useHabitsStore } from '@/store/habits'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { CartesianGrid, XAxis, YAxis, Line, ComposedChart, Bar } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { ChartConfig } from '@/components/ui/chart'

const chartConfig: ChartConfig = {
  count: {
    label: 'Completed',
    color: 'var(--color-chart-1)',
  },
  trend: {
    label: 'Trend',
    color: 'var(--color-chart-2)',
  },
}

export function CompletionChart() {
  const { getCompletionsPerDay } = useHabitsStore()
  const data = getCompletionsPerDay(14)

  const chartData = data.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), 'MMM d'),
    count: d.count,
    trend: d.count,
    total: d.total,
  }))

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.count, d.total)), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Habit Completions (Last 14 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              domain={[0, maxVal]}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Line
              dataKey="trend"
              type="monotone"
              stroke="var(--color-trend)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
