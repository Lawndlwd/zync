import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import {
  FolderOpen,
  Rocket,
  Code,
  Globe,
  BookOpen,
  Zap,
  Star,
  Heart,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import type { Project } from '@zync/shared/types'
import type { LucideIcon } from 'lucide-react'

// ─── Color mapping ───

const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', hover: 'hover:border-indigo-500/30' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', hover: 'hover:border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', hover: 'hover:border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', hover: 'hover:border-amber-500/30' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', hover: 'hover:border-rose-500/30' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', hover: 'hover:border-violet-500/30' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', hover: 'hover:border-teal-500/30' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', hover: 'hover:border-cyan-500/30' },
}

const defaultColor = colorMap.indigo

// ─── Icon mapping ───

const iconMap: Record<string, LucideIcon> = {
  folder: FolderOpen,
  rocket: Rocket,
  code: Code,
  globe: Globe,
  book: BookOpen,
  zap: Zap,
  star: Star,
  heart: Heart,
}

// ─── Helpers (exported for reuse) ───

export function getProjectColor(color?: string) {
  return colorMap[color ?? ''] ?? defaultColor
}

export function getProjectIcon(icon?: string): LucideIcon {
  return iconMap[icon ?? ''] ?? FolderOpen
}

// ─── Component ───

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
        <Card
          className={cn(
            'p-3 cursor-pointer hover:bg-white/[0.04] transition-all',
            colors.hover,
          )}
          onClick={onClick}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
                colors.bg,
              )}
            >
              <Icon size={18} className={colors.text} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-zinc-200 truncate">
                {project.metadata.title || project.name}
              </h3>
              <p className="text-xs text-zinc-500">
                {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 shrink-0" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="group">
      <Card
        className={cn(
          'p-6 cursor-pointer hover:bg-white/[0.04] transition-all',
          colors.hover,
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex items-center justify-center w-14 h-14 rounded-xl',
                colors.bg,
              )}
            >
              <Icon size={28} className={colors.text} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                {project.metadata.title || project.name}
              </h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div
              className="hidden group-hover:flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Trash2 size={16} className="text-zinc-400" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete project "{project.metadata.title || project.name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the project and all its tasks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => onDelete(project.name)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <ChevronRight size={20} className="text-zinc-600 ml-2" />
          </div>
        </div>
      </Card>
    </div>
  )
}
