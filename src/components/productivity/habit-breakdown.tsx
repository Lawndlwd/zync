import { useState } from 'react'
import { useHabitsStore } from '@/store/habits'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format, subDays } from 'date-fns'
import { ArrowUpDown, Flame } from 'lucide-react'
import { HabitIcon } from './habit-icon'
import { cn } from '@/lib/utils'

type SortKey = 'streak' | 'rate'

export function HabitBreakdown() {
  const { logs, getStreak, getBestStreak, getCompletionRate } = useHabitsStore()
  const habits = useHabitsStore((s) => s.habits).filter((h) => !h.archived)
  const [sortBy, setSortBy] = useState<SortKey>('streak')

  const habitStats = habits.map((h) => ({
    habit: h,
    currentStreak: getStreak(h.id),
    bestStreak: getBestStreak(h.id),
    completionRate: getCompletionRate(h.id, 30),
    sparkline: getSparkline(h.id, logs),
  }))

  const sorted = [...habitStats].sort((a, b) =>
    sortBy === 'streak'
      ? b.currentStreak - a.currentStreak
      : b.completionRate - a.completionRate
  )

  if (habits.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-Habit Breakdown</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortBy(sortBy === 'streak' ? 'rate' : 'streak')}
        >
          <ArrowUpDown size={18} />
          Sort by {sortBy === 'streak' ? 'rate' : 'streak'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map(({ habit, currentStreak, bestStreak, completionRate, sparkline }) => (
            <div
              key={habit.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4"
            >
              <HabitIcon name={habit.icon} size={24} className="text-zinc-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-zinc-200 truncate">{habit.name}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                  <span className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-400" />
                    {currentStreak}d
                  </span>
                  <span>Best: {bestStreak}d</span>
                  <span>{completionRate}% (30d)</span>
                </div>
              </div>
              {/* 7-day sparkline */}
              <div className="flex items-end gap-1 h-7">
                {sparkline.map((val, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1.5 rounded-sm',
                      val ? 'bg-indigo-500' : 'bg-zinc-700'
                    )}
                    style={{ height: val ? '100%' : '30%' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getSparkline(habitId: string, logs: { habitId: string; date: string }[]): boolean[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
    return logs.some((l) => l.habitId === habitId && l.date === d)
  })
}
