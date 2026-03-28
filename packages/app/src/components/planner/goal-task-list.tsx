import { CheckSquare, ListChecks, Plus, Square, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useCreateGoalTask, useDeleteGoalTask, useGoalTasks, useToggleGoalTask } from '@/hooks/useGoals'

export function GoalTaskList({ goalId }: { goalId: string }) {
  const { data: tasks = [] } = useGoalTasks(goalId)
  const createTask = useCreateGoalTask()
  const toggleTask = useToggleGoalTask()
  const deleteTask = useDeleteGoalTask()
  const [newTitle, setNewTitle] = useState('')

  const addTask = () => {
    if (!newTitle.trim()) return
    createTask.mutate({ goalId, title: newTitle.trim() })
    setNewTitle('')
  }

  const completed = tasks.filter((t) => t.completed).length

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <ListChecks size={18} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0 ? 'No tasks yet' : `${completed}/${tasks.length} completed`}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
          >
            <button aria-label="Toggle task" onClick={() => toggleTask.mutate(task.id)} className="shrink-0">
              {task.completed ? (
                <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Square size={16} className="text-muted-foreground" />
              )}
            </button>
            <span
              className={`flex-1 text-sm ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
            >
              {task.title}
            </span>
            <button
              aria-label="Remove"
              onClick={() => deleteTask.mutate(task.id)}
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Plus size={14} className="text-muted-foreground" />
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="Add a task..."
          className="h-8 border-0 bg-transparent px-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>
    </div>
  )
}
