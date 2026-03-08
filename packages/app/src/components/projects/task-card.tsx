import { useDraggable } from '@dnd-kit/core'
import { User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@zync/shared/types'

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: draggableId })

  const style: React.CSSProperties = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onSelect(task)}
      className={cn(
        'rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 cursor-pointer hover:bg-white/[0.07] transition-colors',
        isDragging && 'opacity-0 pointer-events-none',
      )}
    >
      {/* Top row: title + priority dot */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-200 truncate">
          {task.metadata.title}
        </span>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            priorityColor[task.metadata.priority] ?? 'bg-zinc-500',
          )}
        />
      </div>

      {/* Bottom row: assignee + optional project badge */}
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
        {task.metadata.assignee === '@ai' ? (
          <Bot size={14} className="shrink-0" />
        ) : (
          <User size={14} className="shrink-0" />
        )}
        <span className="truncate">
          {task.metadata.assignee === '@ai' ? 'AI' : 'Me'}
        </span>

        {showProject && task.project && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-500 truncate">
            {task.project}
          </span>
        )}
      </div>
    </div>
  )
}

/** Overlay variant without sortable hooks – used inside DragOverlay */
export function TaskCardOverlay({ task, showProject }: Omit<TaskCardProps, 'onSelect'>) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 opacity-90 scale-105 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-200 truncate">
          {task.metadata.title}
        </span>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            priorityColor[task.metadata.priority] ?? 'bg-zinc-500',
          )}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
        {task.metadata.assignee === '@ai' ? (
          <Bot size={14} className="shrink-0" />
        ) : (
          <User size={14} className="shrink-0" />
        )}
        <span className="truncate">
          {task.metadata.assignee === '@ai' ? 'AI' : 'Me'}
        </span>
        {showProject && task.project && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-500 truncate">
            {task.project}
          </span>
        )}
      </div>
    </div>
  )
}
