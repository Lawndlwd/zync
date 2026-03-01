import { useHabitsStore } from '@/store/habits'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const intensityColors: Record<number, string> = {
  0: 'bg-zinc-800',
  1: 'bg-indigo-900',
  2: 'bg-indigo-800',
  3: 'bg-indigo-700',
  4: 'bg-indigo-500',
  5: 'bg-indigo-400',
}

export function Heatmap() {
  const { getHeatmapData } = useHabitsStore()
  const data = getHeatmapData(12)

  // Organize into weeks (columns) of 7 days (rows)
  const weeks: { date: string; intensity: number }[][] = []
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7))
  }

  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', '']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Habit Heatmap (12 Weeks)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {/* Day labels */}
          <div className="flex flex-col gap-2 pr-1">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-3 w-6 text-xs text-zinc-500 leading-3">
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-2">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={cn('h-3 w-3 rounded-[2px]', intensityColors[day.intensity])}
                  title={`${format(parseISO(day.date), 'MMM d')} - Level ${day.intensity}`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span>Less</span>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={cn('h-3 w-3 rounded-[2px]', intensityColors[level])}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
