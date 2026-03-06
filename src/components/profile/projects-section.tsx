import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TagInput } from '@/components/ui/tag-input'
import { Plus, Trash2 } from 'lucide-react'
import type { ProfileProject } from '@/types/jobs'

interface ProjectsSectionProps {
  projects: ProfileProject[]
  onChange: (projects: ProfileProject[]) => void
}

export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const update = (index: number, fields: Partial<ProfileProject>) => {
    const updated = projects.map((proj, i) => (i === index ? { ...proj, ...fields } : proj))
    onChange(updated)
  }

  const remove = (index: number) => {
    onChange(projects.filter((_, i) => i !== index))
  }

  const addProject = () => {
    onChange([
      ...projects,
      {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        url: '',
        technologies: [],
      },
    ])
  }

  return (
    <div className="space-y-4">
      {projects.map((proj, i) => (
        <Card key={proj.id} className="relative p-4 bg-white/[0.03] border-white/[0.08]">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 text-zinc-500 hover:text-red-400"
            onClick={() => remove(i)}
          >
            <Trash2 size={14} />
          </Button>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Name</Label>
              <Input
                value={proj.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">URL</Label>
              <Input
                value={proj.url ?? ''}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="Project URL"
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <Label className="text-zinc-400 text-xs">Description</Label>
            <Textarea
              value={proj.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="Describe the project..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-xs">Technologies</Label>
            <TagInput
              value={proj.technologies}
              onChange={(techs) => update(i, { technologies: techs })}
              placeholder="Add technology..."
            />
          </div>
        </Card>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed border-white/[0.1] text-zinc-400 hover:text-zinc-200"
        onClick={addProject}
      >
        <Plus size={16} className="mr-2" />
        Add Project
      </Button>
    </div>
  )
}
