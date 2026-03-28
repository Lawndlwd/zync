import type { GoalBreadcrumb } from '@zync/shared/types'
import { ChevronRight, FolderTree } from 'lucide-react'

interface Props {
  ancestors: GoalBreadcrumb[]
  currentTitle: string
  onNavigate: (goalId: string | null) => void
}

export function ProjectsBreadcrumb({ ancestors, currentTitle, onNavigate }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="shrink-0 flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <FolderTree size={14} />
        Projects
      </button>
      {ancestors.map((a) => (
        <span key={a.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight size={12} className="text-muted-foreground" />
          <button
            onClick={() => onNavigate(a.id)}
            className="hover:text-foreground transition-colors truncate max-w-[150px]"
          >
            {a.title}
          </button>
        </span>
      ))}
      <span className="flex items-center gap-1 shrink-0">
        <ChevronRight size={12} className="text-muted-foreground" />
        <span className="text-foreground truncate max-w-[200px]">{currentTitle}</span>
      </span>
    </nav>
  )
}
