import type { LifeOsComponent, LifeOsComponentType } from '@zync/shared/types'
import { Calendar, ExternalLink, Pencil, Plus, Swords, Target } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateLifeOsComponent, useUpdateLifeOsComponent } from '@/hooks/useLifeOs'

const icons: Record<string, any> = {
  'one-year-goal': Target,
  'one-month-project': Swords,
}

export function MissionCard({
  type,
  component,
  label,
  sublabel,
}: {
  type: LifeOsComponentType
  component?: LifeOsComponent
  label: string
  sublabel: string
}) {
  const Icon = icons[type] || Target
  const navigate = useNavigate()
  const [showDialog, setShowDialog] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const createComponent = useCreateLifeOsComponent()
  const updateComponent = useUpdateLifeOsComponent()

  const openEdit = () => {
    setTitle(component?.title || '')
    setContent(component?.content || '')
    setTargetDate(component?.targetDate || '')
    setShowDialog(true)
  }

  const save = () => {
    if (component) {
      updateComponent.mutate(
        { id: component.id, title, content, targetDate: targetDate || null },
        { onSuccess: () => setShowDialog(false) },
      )
    } else {
      createComponent.mutate(
        { type, title, content, targetDate: targetDate || undefined },
        { onSuccess: () => setShowDialog(false) },
      )
    }
  }

  const daysLeft = component?.targetDate
    ? Math.max(0, Math.ceil((new Date(component.targetDate).getTime() - Date.now()) / 86400000))
    : null

  return (
    <>
      <Card className="gap-0 border-border bg-secondary py-0">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{sublabel}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {component?.linkedGoalId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigate(`/s/projects?g=${component.linkedGoalId}`)}
                  title="View in Projects"
                  aria-label="View in Projects"
                >
                  <ExternalLink size={13} />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEdit} aria-label="Edit mission">
                {component ? <Pencil size={13} /> : <Plus size={14} />}
              </Button>
            </div>
          </div>

          {component ? (
            <div className="flex items-start gap-4">
              {/* Circular progress */}
              <div className="relative shrink-0">
                <svg width={48} height={48} className="-rotate-90">
                  <circle cx={24} cy={24} r={20} fill="none" stroke="var(--secondary)" strokeWidth={4} />
                  <circle
                    cx={24}
                    cy={24}
                    r={20}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 - ((component.progress ?? 0) / 100) * 2 * Math.PI * 20}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                  {component.progress ?? 0}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="mb-1 text-base font-semibold text-foreground">{component.title}</h3>
                {component.content && (
                  <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{component.content}</p>
                )}
                {daysLeft !== null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    <span>{daysLeft} days remaining</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm italic text-muted-foreground">
              Set your {label.toLowerCase()} to start tracking
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {component ? 'Edit' : 'Set'} {label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={`${label} title...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Description..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!title.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
