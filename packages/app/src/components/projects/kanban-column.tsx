import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { TaskCard } from './task-card'
import type { Task, TaskStatus } from '@zync/shared/types'

interface KanbanColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
  onSelectTask: (task: Task) => void
  showProject?: boolean
  color: string
}

const headerStyles: Record<string, string> = {
  zinc: 'bg-zinc-500/10 text-zinc-300',
  blue: 'bg-blue-500/10 text-blue-300',
  emerald: 'bg-emerald-500/10 text-emerald-300',
}

const countStyles: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  blue: 'bg-blue-500/20 text-blue-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
}

export function KanbanColumn({
  id,
  title,
  tasks,
  onSelectTask,
  showProject,
  color,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex-1 min-w-[280px] flex flex-col">
      {/* Header */}
      <div
        className={cn(
          'rounded-lg border border-white/[0.06] px-4 py-3 mb-3 flex items-center justify-between',
          headerStyles[color] ?? headerStyles.zinc,
        )}
      >
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            countStyles[color] ?? countStyles.zinc,
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto space-y-2 p-2 rounded-lg min-h-[120px] transition-colors',
          isOver && 'bg-white/[0.03] border border-dashed border-white/[0.1]',
        )}
      >
        {tasks.map((task) => (
          <TaskCard
            key={`${task.project}/${task.fileName}`}
            task={task}
            onSelect={onSelectTask}
            showProject={showProject}
          />
        ))}
      </div>
    </div>
  )
}
