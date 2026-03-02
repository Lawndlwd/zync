import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useCreateProject } from '@/hooks/useProjects'
import {
  FolderOpen,
  Rocket,
  Code,
  Globe,
  BookOpen,
  Zap,
  Star,
  Heart,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Options ───

const COLOR_OPTIONS = [
  { name: 'indigo',  bg: 'bg-indigo-500',  ring: 'ring-indigo-400' },
  { name: 'blue',    bg: 'bg-blue-500',    ring: 'ring-blue-400' },
  { name: 'emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { name: 'amber',   bg: 'bg-amber-500',   ring: 'ring-amber-400' },
  { name: 'rose',    bg: 'bg-rose-500',    ring: 'ring-rose-400' },
  { name: 'violet',  bg: 'bg-violet-500',  ring: 'ring-violet-400' },
  { name: 'teal',    bg: 'bg-teal-500',    ring: 'ring-teal-400' },
  { name: 'cyan',    bg: 'bg-cyan-500',    ring: 'ring-cyan-400' },
] as const

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'folder', icon: FolderOpen },
  { name: 'rocket', icon: Rocket },
  { name: 'code',   icon: Code },
  { name: 'globe',  icon: Globe },
  { name: 'book',   icon: BookOpen },
  { name: 'zap',    icon: Zap },
  { name: 'star',   icon: Star },
  { name: 'heart',  icon: Heart },
]

// ─── Component ───

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const createProject = useCreateProject()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('indigo')
  const [icon, setIcon] = useState('folder')

  const resetForm = () => {
    setName('')
    setDescription('')
    setColor('indigo')
    setIcon('folder')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    createProject.mutate(
      {
        name: name.trim(),
        title: name.trim(),
        description: description.trim(),
        color,
        icon,
      },
      {
        onSuccess: () => {
          toast.success('Project created')
          resetForm()
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create project')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name..."
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => setColor(opt.name)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    opt.bg,
                    color === opt.name
                      ? `ring-2 ${opt.ring} ring-offset-2 ring-offset-zinc-900`
                      : 'opacity-60 hover:opacity-100',
                  )}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Icon</label>
            <div className="flex items-center gap-2">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.icon
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIcon(opt.name)}
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-lg border transition-all',
                      icon === opt.name
                        ? 'border-zinc-400 bg-white/[0.08] ring-2 ring-zinc-400 ring-offset-1 ring-offset-zinc-900'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400',
                    )}
                  >
                    <IconComp size={20} className={icon === opt.name ? 'text-zinc-100' : ''} />
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createProject.isPending}>
              {createProject.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
