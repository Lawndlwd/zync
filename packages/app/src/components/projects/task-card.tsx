import { useDraggable } from '@dnd-kit/core'
import type { Task } from '@zync/shared/types'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  onSelect: (task: Task) => void
  showProject?: boolean
}

const priorityColor: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-emerald-400',
}

export function TaskCard({ task, onSelect, showProject }: TaskCardProps) {
  const draggableId = `${task.project}/${task.fileName}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: draggableId })

  const style: React.CSSProperties = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onSelect(task)}
      className={cn(
        'rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent transition-colors',
        isDragging && 'opacity-0 pointer-events-none',
      )}
    >
      {/* Top row: title + priority dot */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-card-foreground truncate">{task.metadata.title}</span>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            priorityColor[task.metadata.priority] ?? 'bg-muted-foreground',
          )}
        />
      </div>

      {/* Bottom row: assignee + optional project badge */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {task.metadata.assignee === '@ai' ? (
          <Bot size={14} className="shrink-0" />
        ) : (
          <User size={14} className="shrink-0" />
        )}
        <span className="truncate">{task.metadata.assignee === '@ai' ? 'AI' : 'Me'}</span>

        {showProject && task.project && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground truncate">
            {task.project}
          </span>
        )}
      </div>
    </div>
  )
}
