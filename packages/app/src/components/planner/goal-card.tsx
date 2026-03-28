import type { PlannerGoal } from '@zync/shared/types'
import { Check, Target, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDeleteGoal, useUpdateGoal } from '@/hooks/usePlanner'
import { cn } from '@/lib/utils'

interface GoalCardProps {
  goal: PlannerGoal
}

const statusVariant: Record<string, 'warning' | 'success' | 'default'> = {
  active: 'warning',
  completed: 'success',
  abandoned: 'default',
}

export function GoalCard({ goal }: GoalCardProps) {
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const progressColor =
    goal.progress >= 75
      ? 'bg-emerald-600 dark:bg-emerald-400'
      : goal.progress >= 40
        ? 'bg-primary'
        : 'bg-muted-foreground'

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target size={16} className="shrink-0 text-primary" />
          <h4 className="truncate text-sm font-semibold text-foreground">{goal.title}</h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {goal.status === 'active' && (
            <Button
              variant="ghost"
              size="xs"
              aria-label="Complete goal"
              onClick={() => updateGoal.mutate({ id: goal.id, status: 'completed', progress: 100 })}
            >
              <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            </Button>
          )}
          <Button variant="ghost" size="xs" aria-label="Delete goal" onClick={() => deleteGoal.mutate(goal.id)}>
            <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
      {goal.description && <p className="line-clamp-2 text-sm text-muted-foreground">{goal.description}</p>}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
          <div
            className={cn('h-full rounded-full transition-all', progressColor)}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <Badge variant={statusVariant[goal.status] || 'default'}>{goal.progress}%</Badge>
      </div>
      {goal.targetDate && <p className="text-xs text-muted-foreground">Target: {goal.targetDate}</p>}
    </Card>
  )
}
