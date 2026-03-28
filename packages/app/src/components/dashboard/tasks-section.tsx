import { KanbanSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { Section } from './section'
import { StatBlock } from './stat-block'

export function TasksSection({ span }: { span?: string }) {
  const { data: allTasks = [], isLoading } = useAllTasks()
  const { data: projects = [] } = useProjects()

  const todo = allTasks.filter((t) => t.metadata.status === 'todo').length
  const inProgress = allTasks.filter((t) => t.metadata.status === 'in-progress').length
  const done = allTasks.filter((t) => t.metadata.status === 'completed').length
  const highPriority = allTasks.filter((t) => t.metadata.priority === 'high')

  return (
    <Section
      icon={KanbanSquare}
      iconColor="text-primary"
      title="Tasks & Projects"
      to="/tasks"
      className={cn('col-span-12 lg:col-span-4', span)}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 rounded-2xl bg-secondary py-4">
            <StatBlock label="To Do" value={todo} color="text-foreground" />
            <div className="w-px h-8 bg-border" />
            <StatBlock label="In Progress" value={inProgress} color="text-primary" />
            <div className="w-px h-8 bg-border" />
            <StatBlock label="Done" value={done} color="text-primary" />
          </div>

          {projects.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{projects.length}</span> project
              {projects.length !== 1 ? 's' : ''}
            </div>
          )}

          {highPriority.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">High Priority</p>
              {highPriority.slice(0, 5).map((task) => (
                <Link
                  key={`${task.project}/${task.fileName}`}
                  to={`/tasks?task=${task.project}/${task.fileName}`}
                  className="flex items-center gap-3 rounded-xl px-4 py-2.5 hover:bg-secondary transition-colors"
                >
                  <span className="text-sm font-mono text-muted-foreground shrink-0">{task.project}</span>
                  <span className="text-sm text-foreground truncate">{task.metadata.title}</span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded-xl px-3 py-1 text-xs font-medium',
                      task.metadata.status === 'todo' && 'bg-secondary text-muted-foreground',
                      task.metadata.status === 'in-progress' && 'bg-primary/10 text-primary',
                      task.metadata.status === 'completed' && 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {task.metadata.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {allTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet</p>}
        </>
      )}
    </Section>
  )
}
