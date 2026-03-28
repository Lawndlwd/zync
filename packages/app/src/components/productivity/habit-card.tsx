import type { Habit } from '@zync/shared/types'
import { format } from 'date-fns'
import { CheckCircle2, Flame, RotateCcw, Trash2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useHabitsStore } from '@/store/habits'
import { HabitIcon } from './habit-icon'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getScheduleDays(habit: Habit): number[] {
  if (habit.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6]
  if (habit.frequency === 'weekdays') return [1, 2, 3, 4, 5]
  if (habit.frequency === 'weekends') return [0, 6]
  if (habit.frequency === 'custom' && habit.customDays) return habit.customDays
  return [0, 1, 2, 3, 4, 5, 6]
}

interface HabitCardProps {
  habit: Habit
  variant?: 'active' | 'archived'
}

export function HabitCard({ habit, variant = 'active' }: HabitCardProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { logs, toggleHabitForDate, getStreak, getCompletionRate, getCycleProgress, restartHabit, removeHabit } =
    useHabitsStore()

  const done = logs.some((l) => l.habitId === habit.id && l.date === today)
  const streak = getStreak(habit.id)
  const rate = getCompletionRate(habit.id, 30)
  const cycle = getCycleProgress(habit.id)
  const scheduleDays = getScheduleDays(habit)

  return (
    <Card className={cn('p-4', variant === 'archived' && 'opacity-60')}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
            done ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
          )}
        >
          <HabitIcon name={habit.icon} size={24} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className={cn('text-base font-medium truncate', done ? 'text-muted-foreground' : 'text-foreground')}>
              {habit.name}
            </p>
            {cycle?.isComplete && (
              <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                <Trophy size={14} />
                Cycle complete
              </span>
            )}
          </div>

          {/* Schedule dots */}
          <div className="mt-1 flex gap-2">
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded text-xs',
                  scheduleDays.includes(i) ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Cycle progress bar */}
          {cycle && !cycle.isComplete && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                <span>Day {cycle.dayNumber}</span>
                <span>{cycle.targetDays}d target</span>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (cycle.dayNumber / cycle.targetDays) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            {streak > 0 && (
              <span className="flex items-center gap-2 text-amber-400">
                <Flame size={14} /> {streak}d
              </span>
            )}
            <span>{rate}% (30d)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {variant === 'archived' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => restartHabit(habit.id)} className="gap-2 text-sm">
                <RotateCcw size={16} />
                Restart
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-red-400"
                onClick={() => removeHabit(habit.id)}
              >
                <Trash2 size={18} />
              </Button>
            </>
          ) : (
            <>
              {cycle?.isComplete && (
                <Button variant="ghost" size="sm" onClick={() => restartHabit(habit.id)} className="gap-2 text-sm">
                  <RotateCcw size={16} />
                  Restart
                </Button>
              )}
              <button
                onClick={() => toggleHabitForDate(habit.id, today)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                  done
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary text-muted-foreground hover:text-primary',
                )}
              >
                <CheckCircle2 size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
