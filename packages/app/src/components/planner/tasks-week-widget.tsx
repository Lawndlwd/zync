import { useQueryClient } from '@tanstack/react-query'
import { isThisWeek } from 'date-fns'
import { Circle, ListTodo } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTodos } from '@/hooks/useTodos'
import { updateTodo } from '@/services/todos'
import { usePlannerStore } from '@/store/planner'

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'info',
  P4: 'default',
}

const priorityLabels: Record<string, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
}

export function TasksWeekWidget() {
  const { data: todos = [] } = useTodos()
  const viewMode = usePlannerStore((s) => s.taskViewMode)
  const setViewMode = usePlannerStore((s) => s.setTaskViewMode)
  const qc = useQueryClient()

  const weekTasks = todos.filter((t) => {
    if (t.status === 'done') return false
    if (t.dueDate) {
      try {
        return isThisWeek(new Date(t.dueDate), { weekStartsOn: 1 })
      } catch {
        return false
      }
    }
    return true
  })

  const sorted =
    viewMode === 'priority'
      ? [...weekTasks].sort((a, b) => (a.priority || 'P3').localeCompare(b.priority || 'P3'))
      : weekTasks

  const toggleDone = async (id: string) => {
    await updateTodo(id, { status: 'done' })
    qc.invalidateQueries({ queryKey: ['todos'] })
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo size={18} className="text-muted-foreground" />
          Tasks this week
        </CardTitle>
        <CardAction>
          <div className="flex gap-1">
            {(['list', 'priority'] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setViewMode(mode)}
                className="capitalize text-xs"
              >
                {mode}
              </Button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No tasks this week</p>
        ) : (
          <div className="space-y-1">
            {sorted.slice(0, 8).map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary"
              >
                <button
                  onClick={() => toggleDone(task.id)}
                  className="shrink-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <Circle size={16} />
                </button>
                <span className="flex-1 truncate text-sm text-foreground">{task.title}</span>
                {task.priority && (
                  <Badge variant={priorityVariant[task.priority] || 'default'}>
                    {priorityLabels[task.priority] || task.priority}
                  </Badge>
                )}
              </div>
            ))}
            {sorted.length > 8 && (
              <p className="pt-2 text-center text-sm text-muted-foreground">+{sorted.length - 8} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
