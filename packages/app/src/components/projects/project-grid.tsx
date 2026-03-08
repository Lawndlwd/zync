import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Project } from '@zync/shared/types'
import { ProjectCard } from './project-card'

interface ProjectGridProps {
  projects: Project[]
  onSelectProject: (name: string) => void
  onDeleteProject: (name: string) => void
  onCreateProject?: () => void
}

export function ProjectGrid({
  projects,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
        <FolderOpen size={64} className="mb-4 text-zinc-700" />
        <p className="text-lg">No projects yet</p>
        <p className="text-base text-zinc-600 mt-1">
          Create a project to start organizing your tasks
        </p>
        {onCreateProject && (
          <Button onClick={onCreateProject} className="mt-5 gap-2">
            <Plus size={18} /> New Project
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.name}
          project={project}
          onClick={() => onSelectProject(project.name)}
          onDelete={onDeleteProject}
        />
      ))}
    </div>
  )
}
