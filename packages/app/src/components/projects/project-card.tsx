import type { Project } from '@zync/shared/types'
import { ChevronRight, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getProjectColor, getProjectIcon } from './project-utils'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onDelete: (name: string) => void
  compact?: boolean
}

export function ProjectCard({ project, onClick, onDelete, compact }: ProjectCardProps) {
  const colors = getProjectColor(project.metadata.color)
  const Icon = getProjectIcon(project.metadata.icon)

  if (compact) {
    return (
      <div className="group">
        <Card className={cn('p-3 cursor-pointer hover:bg-accent transition-all', colors.hover)} onClick={onClick}>
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg shrink-0', colors.bg)}>
              <Icon size={18} className={colors.text} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-card-foreground truncate">
                {project.metadata.title || project.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="group">
      <Card className={cn('p-6 cursor-pointer hover:bg-accent transition-all', colors.hover)} onClick={onClick}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('flex items-center justify-center w-14 h-14 rounded-xl', colors.bg)}>
              <Icon size={28} className={colors.text} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">{project.metadata.title || project.name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="hidden group-hover:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Trash2 size={16} className="text-muted-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete project "{project.metadata.title || project.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the project and all its tasks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => onDelete(project.name)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <ChevronRight size={20} className="text-muted-foreground ml-2" />
          </div>
        </div>
      </Card>
    </div>
  )
}
