import { format } from 'date-fns'
import { Check, Circle, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useHabitsStore } from '@/store/habits'

export function HabitsTodayWidget() {
  const store = useHabitsStore()

  const today = format(new Date(), 'yyyy-MM-dd')
  const habits = store.getActiveHabits()
  const todayCompletions = store.getCompletionsForDate(today)
  const completedIds = new Set(todayCompletions.map((l) => l.habitId))

  const dueToday = habits.filter((h) => store.isHabitDueToday(h.id))
  const completed = dueToday.filter((h) => completedIds.has(h.id)).length
  const total = dueToday.length

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame size={18} className="text-primary" />
          Habits today
        </CardTitle>
        {total > 0 && (
          <CardAction>
            <Badge variant={completed === total ? 'success' : 'warning'}>
              {completed}/{total}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-4">
        {dueToday.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No habits due today</p>
        ) : (
          <div className="space-y-1">
            {dueToday.map((habit) => {
              const isDone = completedIds.has(habit.id)
              const streak = store.getStreak(habit.id)
              return (
                <div
                  key={habit.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                >
                  <button
                    onClick={() => store.toggleHabitForDate(habit.id, today)}
                    className={cn(
                      'shrink-0 transition-colors',
                      isDone
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400',
                    )}
                  >
                    {isDone ? <Check size={16} /> : <Circle size={16} />}
                  </button>
                  <span className="text-base">{habit.icon}</span>
                  <span
                    className={cn(
                      'flex-1 truncate text-sm',
                      isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {habit.name}
                  </span>
                  {streak > 0 && <Badge variant="warning">{streak}d</Badge>}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
