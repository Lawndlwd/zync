import { useHabitsStore } from '@/store/habits'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { Target, Flame, Hash, TrendingUp } from 'lucide-react'

export function MetricsRow() {
  const { logs, getWeeklyScore, getStreak, isHabitDueToday } = useHabitsStore()
  const habits = useHabitsStore((s) => s.habits)
  const today = format(new Date(), 'yyyy-MM-dd')

  const active = habits.filter((h) => !h.archived)
  const dueToday = active.filter((h) => isHabitDueToday(h.id))
  const completedToday = logs.filter((l) => l.date === today && dueToday.some((h) => h.id === l.habitId)).length
  const completionPct = dueToday.length > 0 ? Math.round((completedToday / dueToday.length) * 100) : 0

  const bestStreak = active.reduce((best, h) => {
    const s = getStreak(h.id)
    return s > best ? s : best
  }, 0)

  const weeklyScore = getWeeklyScore()

  const metrics = [
    {
      icon: <Target size={24} />,
      label: 'Completion Rate',
      value: `${completionPct}%`,
      sub: `${completedToday}/${dueToday.length} due today`,
      color: 'text-indigo-400 bg-indigo-500/10',
    },
    {
      icon: <Flame size={24} />,
      label: 'Best Active Streak',
      value: `${bestStreak}`,
      sub: 'days',
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      icon: <Hash size={24} />,
      label: 'Habits Tracked',
      value: `${active.length}`,
      sub: 'total',
      color: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      icon: <TrendingUp size={24} />,
      label: 'Weekly Score',
      value: `${weeklyScore}%`,
      sub: 'last 7 days',
      color: 'text-sky-400 bg-sky-500/10',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
              {m.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-100">{m.value}</p>
              <p className="text-sm text-zinc-500">{m.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
