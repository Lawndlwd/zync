import { useMemo } from 'react'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hourLabels = Array.from({ length: 24 }, (_, i) => i)

const colorScale = [
  'rgba(255,255,255,0.03)',
  'rgba(99,102,241,0.15)',
  'rgba(79,70,229,0.30)',
  'rgba(99,102,241,0.50)',
  'rgba(129,140,248,0.70)',
  'rgba(165,180,252,0.85)',
]

function getColor(intensity: number): string {
  if (intensity === 0) return colorScale[0]
  const idx = Math.min(Math.floor(intensity * (colorScale.length - 1)) + 1, colorScale.length - 1)
  return colorScale[idx]
}

interface Props {
  data: Array<{ day_of_week: number; hour: number; avg_engagement: number }>
}

export function PostingHeatmap({ data }: Props) {
  const { grid, maxVal } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let max = 0
    for (const d of data) {
      const dow = d.day_of_week
      const h = d.hour
      if (dow == null || h == null || dow < 0 || dow > 6 || h < 0 || h > 23) continue
      g[dow][h] = d.avg_engagement ?? 0
      if (d.avg_engagement > max) max = d.avg_engagement
    }
    return { grid: g, maxVal: max }
  }, [data])

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No posting time data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Best Time to Post</p>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Hour labels */}
          <div className="flex ml-10 mb-1 gap-[3px]">
            {hourLabels.map((h) =>
              h % 3 === 0 ? (
                <span
                  key={h}
                  className="text-[10px] text-zinc-500 text-center"
                  style={{ width: 28, marginLeft: h === 0 ? 0 : (3 - 1) * 31 }}
                >
                  {h.toString().padStart(2, '0')}
                </span>
              ) : null,
            )}
          </div>
          {/* Grid rows */}
          {grid.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-[3px] mb-[3px]">
              <span className="w-8 text-[10px] text-zinc-500 text-right mr-1.5 shrink-0">
                {dayLabels[dayIdx]}
              </span>
              {row.map((val, hourIdx) => {
                const intensity = maxVal > 0 ? val / maxVal : 0
                return (
                  <div
                    key={hourIdx}
                    className="min-w-[28px] min-h-[28px] rounded-[3px] transition-colors"
                    style={{ backgroundColor: getColor(intensity) }}
                    title={`${dayLabels[dayIdx]} ${hourIdx.toString().padStart(2, '0')}:00 — avg: ${val.toFixed(1)}`}
                  />
                )
              })}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 ml-10">
            <span className="text-[10px] text-zinc-500">Low</span>
            <div className="flex gap-[2px]">
              {colorScale.map((c, i) => (
                <div
                  key={i}
                  className="w-5 h-3 rounded-[2px]"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-[10px] text-zinc-500">High</span>
          </div>
        </div>
      </div>
    </div>
  )
}
