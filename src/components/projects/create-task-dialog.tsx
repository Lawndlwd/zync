import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/useProjects'
import { useCreateTask } from '@/hooks/useTasks'
import { User, Bot, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Component ───

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProject?: string
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultProject,
}: CreateTaskDialogProps) {
  const { data: projects = [] } = useProjects()
  const createTask = useCreateTask()

  const [title, setTitle] = useState('')
  const [project, setProject] = useState(defaultProject ?? '')
  const [assignee, setAssignee] = useState<'@me' | '@ai'>('@me')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [description, setDescription] = useState('')

  // Sync defaultProject when it changes or dialog opens
  useEffect(() => {
    if (open && defaultProject) {
      setProject(defaultProject)
    }
  }, [open, defaultProject])

  const resetForm = () => {
    setTitle('')
    setProject(defaultProject ?? '')
    setAssignee('@me')
    setPriority('medium')
    setDescription('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !project) return

    createTask.mutate(
      {
        projectName: project,
        title: title.trim(),
        assignee,
        priority,
        content: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Task created')
          resetForm()
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create task')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              required
            />
          </div>

          {/* Project */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Project</label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.metadata.title || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Assignee</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={assignee === '@me' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setAssignee('@me')}
              >
                <User size={16} />
                @me
              </Button>
              <Button
                type="button"
                variant={assignee === '@ai' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setAssignee('@ai')}
              >
                <Bot size={16} />
                @ai
              </Button>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Priority</label>
            <div className="flex items-center gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'capitalize',
                    priority === p && p === 'high' && 'bg-rose-600 hover:bg-rose-700',
                    priority === p && p === 'low' && 'bg-zinc-600 hover:bg-zinc-700',
                  )}
                >
                  {p}
                </Button>
              ))}
            </div>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !project || createTask.isPending}
            >
              {createTask.isPending ? (
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
