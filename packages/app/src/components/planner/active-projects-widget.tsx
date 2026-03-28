import { FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

const projectColors = [
  'from-primary/20 to-primary/5 border-primary/20',
  'from-muted to-muted/5 border-border',
  'from-muted to-muted/5 border-border',
  'from-muted to-muted/5 border-border',
  'from-muted to-muted/5 border-border',
]

export function ActiveProjectsWidget() {
  const { data: projects = [] } = useProjects()
  const activeProjects = projects.slice(0, 6)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban size={18} className="text-muted-foreground" />
          Active projects
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {activeProjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeProjects.map((project, i) => {
              const meta = project.metadata || {}
              const colorClass = projectColors[i % projectColors.length]
              return (
                <Card
                  key={project.name}
                  className={cn('bg-gradient-to-br p-4 transition-colors hover:brightness-110 gap-2', colorClass)}
                >
                  <div className="flex items-center gap-2">
                    {meta.icon && <span className="text-base">{meta.icon}</span>}
                    <span className="truncate text-sm font-semibold text-foreground">{meta.title || project.name}</span>
                  </div>
                  {meta.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
                  )}
                  {meta.tags && meta.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {meta.tags.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="default" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
