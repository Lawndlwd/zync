import { useState } from 'react'
import { useGitlabProjects } from '@/hooks/useGitlab'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import type { GitLabProject } from '@/types/gitlab'

interface ProjectPickerProps {
  value: number | null
  onChange: (project: GitLabProject) => void
}

export function ProjectPicker({ value, onChange }: ProjectPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const { data: projects } = useGitlabProjects(search || undefined)

  const selected = projects?.find((p) => p.id === value)

  return (
    <div className="relative">
      <div
        className="flex h-9 w-full cursor-pointer items-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-100"
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <span className="truncate">{selected.path_with_namespace}</span>
        ) : (
          <span className="text-zinc-500">Select project...</span>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-80 rounded-lg border border-white/[0.1] bg-[#1a1d1e]/95 backdrop-blur-md p-2 shadow-xl">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {projects?.map((project) => (
              <button
                key={project.id}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-white/[0.06]"
                onClick={() => {
                  onChange(project)
                  setOpen(false)
                  setSearch('')
                }}
              >
                <span className="truncate">{project.path_with_namespace}</span>
              </button>
            ))}
            {projects?.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-zinc-500">No projects found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
