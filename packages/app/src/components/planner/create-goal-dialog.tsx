import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCreateGoal } from '@/hooks/useGoals'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId?: string
  granularity: string
}

export function CreateGoalDialog({ open, onOpenChange, parentId, granularity }: Props) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return granularity === 'year' ? `${now.getFullYear()}-01-01` : now.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => {
    const now = new Date()
    return granularity === 'year' ? `${now.getFullYear()}-12-31` : now.toISOString().slice(0, 10)
  })
  const createGoal = useCreateGoal()

  const submit = () => {
    if (!title.trim() || !startDate || !endDate) return
    createGoal.mutate(
      { granularity, title: title.trim(), startDate, endDate, parentId },
      {
        onSuccess: () => {
          setTitle('')
          onOpenChange(false)
        },
      },
    )
  }

  const labels: Record<string, string> = {
    year: 'Year Goal (Mission)',
    month: 'Month Goal',
    week: 'Week Goal',
    day: 'Day Goal',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {labels[granularity] || 'Goal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={granularity === 'year' ? 'e.g., Build my dream business' : 'Goal title'}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!title.trim() || createGoal.isPending}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
