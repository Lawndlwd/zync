import { Pie, PieChart, Cell, Label } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface EngagementBreakdownChartProps {
  data: Array<{ type: string; value: number }>
}

const TYPE_COLORS: Record<string, string> = {
  Likes: '#fb7185',
  Comments: '#38bdf8',
  Shares: '#fbbf24',
  Saves: '#34d399',
}

const chartConfig: ChartConfig = {
  Likes: { label: 'Likes', color: '#fb7185' },
  Comments: { label: 'Comments', color: '#38bdf8' },
  Shares: { label: 'Shares', color: '#fbbf24' },
  Saves: { label: 'Saves', color: '#34d399' },
}

export function EngagementBreakdownChart({ data }: EngagementBreakdownChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm font-medium text-zinc-400 mb-3">Engagement Breakdown</p>
        <p className="text-sm text-zinc-500">No data</p>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Engagement Breakdown</p>
      <div className="flex items-center gap-6">
        <ChartContainer config={chartConfig} className="h-[180px] w-[180px] shrink-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="type" />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="type"
              innerRadius={60}
              outerRadius={80}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.type}
                  fill={TYPE_COLORS[entry.type] ?? '#71717a'}
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-zinc-100 text-xl font-bold"
                        >
                          {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(total)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 18}
                          className="fill-zinc-500 text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    )
                  }
                  return null
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex flex-col gap-2">
          {data.map((entry) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
            return (
              <div key={entry.type} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[entry.type] ?? '#71717a' }}
                />
                <span className="text-zinc-400">{entry.type}</span>
                <span className="ml-auto font-medium text-zinc-200">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
