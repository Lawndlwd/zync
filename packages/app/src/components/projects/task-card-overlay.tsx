import type { Task } from '@zync/shared/types'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const priorityColor: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-emerald-400',
}

/** Overlay variant without sortable hooks — used inside DragOverlay */
export function TaskCardOverlay({ task, showProject }: { task: Task; showProject?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 opacity-90 scale-105 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-card-foreground truncate">{task.metadata.title}</span>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            priorityColor[task.metadata.priority] ?? 'bg-muted-foreground',
          )}
        />
      </div>
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
