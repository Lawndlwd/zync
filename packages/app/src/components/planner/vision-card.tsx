import type { LifeOsComponent } from '@zync/shared/types'
import { Check, Eye, EyeOff, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateLifeOsComponent, useUpdateLifeOsComponent } from '@/hooks/useLifeOs'

const config = {
  'anti-vision': {
    label: 'Anti-Vision',
    sublabel: 'Stakes — The life you never want',
    icon: EyeOff,
    border: 'border-destructive/20',
    bg: 'bg-destructive/5',
    accent: 'text-destructive',
    iconBg: 'bg-destructive/10',
    placeholder:
      'Describe in vivid detail the life you never want to live. What does a Tuesday look like in 5 years if nothing changes?',
  },
  vision: {
    label: 'Vision',
    sublabel: 'Win Condition — Your ideal life',
    icon: Eye,
    border: 'border-primary/20',
    bg: 'bg-primary/5',
    accent: 'text-primary',
    iconBg: 'bg-primary/10',
    placeholder:
      'Describe your ideal life in 3 years. What does an average Tuesday look like? Where are you? What are you doing?',
  },
}

export function VisionCard({ type, component }: { type: 'anti-vision' | 'vision'; component?: LifeOsComponent }) {
  const cfg = config[type]
  const Icon = cfg.icon
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const createComponent = useCreateLifeOsComponent()
  const updateComponent = useUpdateLifeOsComponent()

  const startEdit = () => {
    setTitle(component?.title || cfg.label)
    setContent(component?.content || '')
    setEditing(true)
  }

  const save = () => {
    if (component) {
      updateComponent.mutate({ id: component.id, title, content }, { onSuccess: () => setEditing(false) })
    } else {
      createComponent.mutate({ type, title, content }, { onSuccess: () => setEditing(false) })
    }
  }

  return (
    <Card className={`gap-0 py-0 ${cfg.border} ${cfg.bg}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.iconBg}`}>
              <Icon size={18} className={cfg.accent} />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${cfg.accent}`}>{cfg.label}</h3>
              <p className="text-xs text-muted-foreground">{cfg.sublabel}</p>
            </div>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEdit} aria-label="Edit">
              <Pencil size={14} />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
              placeholder="Title..."
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={cfg.placeholder}
              rows={5}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={createComponent.isPending || updateComponent.isPending}>
                <Check size={14} className="mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X size={14} className="mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {component?.content || <span className="italic text-muted-foreground">{cfg.placeholder}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
