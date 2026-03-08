import { ArrowUp, ArrowDown } from 'lucide-react'
import { Area, AreaChart } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

interface KpiCardProps {
  title: string
  value: number
  delta: number
  sparklineData: Array<{ date: string; value: number }>
  format?: 'number' | 'percent' | 'compact'
}

function formatValue(value: number, format: 'number' | 'percent' | 'compact') {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'compact':
      return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
    default:
      return value.toLocaleString()
  }
}

export function KpiCard({ title, value, delta, sparklineData, format = 'number' }: KpiCardProps) {
  const isPositive = delta > 0
  const isNegative = delta < 0
  const sparkColor = delta >= 0 ? '#34d399' : '#fb7185'

  const chartConfig: ChartConfig = {
    value: { label: title, color: sparkColor },
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-100">
            {formatValue(value, format)}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {isPositive && <ArrowUp className="h-3 w-3 text-emerald-400" />}
            {isNegative && <ArrowDown className="h-3 w-3 text-rose-400" />}
            <span
              className={
                isPositive
                  ? 'text-xs text-emerald-400'
                  : isNegative
                    ? 'text-xs text-rose-400'
                    : 'text-xs text-zinc-500'
              }
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          </div>
        </div>

        {sparklineData.length > 0 && (
          <div className="h-[60px] w-[100px] shrink-0">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`sparkGrad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#sparkGrad-${title.replace(/\s+/g, '')})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </div>
  )
}
