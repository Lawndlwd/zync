import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  DollarSign,
  Dumbbell,
  FolderKanban,
  ListTodo,
  MapPin,
  Plus,
  Receipt,
  StickyNote,
  UtensilsCrossed,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreatePage, useCreateReminder } from '@/hooks/usePlanner'
import { createTodo } from '@/services/todos'

const actions = [
  { key: 'note', label: 'New page', icon: StickyNote, color: 'text-primary' },
  { key: 'task', label: 'New task', icon: ListTodo, color: 'text-primary' },
  { key: 'expense', label: 'New expense', icon: Receipt, color: 'text-primary' },
  { key: 'income', label: 'New income', icon: DollarSign, color: 'text-muted-foreground' },
  { key: 'trip', label: 'New trip idea', icon: MapPin, color: 'text-muted-foreground' },
  { key: 'recipe', label: 'New recipe', icon: UtensilsCrossed, color: 'text-muted-foreground' },
  { key: 'project', label: 'New project', icon: FolderKanban, color: 'text-muted-foreground' },
  { key: 'training', label: 'New training', icon: Dumbbell, color: 'text-muted-foreground' },
  { key: 'reminder', label: 'New reminder', icon: Bell, color: 'text-muted-foreground' },
] as const

type ActionKey = (typeof actions)[number]['key']

interface FastActionsProps {
  categoryId: string
}

export function FastActions({ categoryId }: FastActionsProps) {
  const [openDialog, setOpenDialog] = useState<ActionKey | null>(null)
  const createPage = useCreatePage()
  const navigate = useNavigate()

  const handleAction = (key: ActionKey) => {
    if (key === 'note') {
      createPage.mutate({ categoryId, title: 'Untitled' }, { onSuccess: (page) => navigate(`/page/${page.id}`) })
      return
    }
    setOpenDialog(key)
  }

  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus size={18} className="text-primary" />
            Fast actions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <div className="grid grid-cols-1 gap-0.5">
            {actions.map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => handleAction(key)}
                disabled={key === 'note' && createPage.isPending}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <Icon size={16} className={color} />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {openDialog === 'task' && <TaskDialog onClose={() => setOpenDialog(null)} />}
      {openDialog === 'reminder' && <ReminderDialog onClose={() => setOpenDialog(null)} />}
      {openDialog && !['task', 'reminder'].includes(openDialog) && (
        <Dialog open onOpenChange={() => setOpenDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="capitalize text-lg">New {openDialog}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Coming soon — this feature will be available in a future update.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('P3')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await createTodo({ title: title.trim(), priority })
      qc.invalidateQueries({ queryKey: ['todos'] })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg">New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P1">P1 - Critical</SelectItem>
                <SelectItem value="P2">P2 - High</SelectItem>
                <SelectItem value="P3">P3 - Medium</SelectItem>
                <SelectItem value="P4">P4 - Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReminderDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const createReminder = useCreateReminder()

  const handleSubmit = () => {
    if (!title.trim() || !dueAt) return
    createReminder.mutate({ title: title.trim(), dueAt }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg">New Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Reminder title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Due date & time</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || !dueAt || createReminder.isPending}>
              {createReminder.isPending ? 'Creating...' : 'Create Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
