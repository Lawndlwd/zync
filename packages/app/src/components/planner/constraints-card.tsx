import type { LifeOsComponent } from '@zync/shared/types'
import { Plus, Shield, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCreateLifeOsComponent, useUpdateLifeOsComponent } from '@/hooks/useLifeOs'

export function ConstraintsCard({ component }: { component?: LifeOsComponent }) {
  const [newItem, setNewItem] = useState('')
  const createComponent = useCreateLifeOsComponent()
  const updateComponent = useUpdateLifeOsComponent()

  // Constraints stored as newline-separated list in content
  const items = (component?.content || '').split('\n').filter(Boolean)

  const addItem = () => {
    if (!newItem.trim()) return
    const updated = [...items, newItem.trim()].join('\n')
    if (component) {
      updateComponent.mutate({ id: component.id, content: updated })
    } else {
      createComponent.mutate({ type: 'constraints', title: 'Constraints', content: updated })
    }
    setNewItem('')
  }

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx).join('\n')
    if (component) {
      updateComponent.mutate({ id: component.id, content: updated })
    }
  }

  return (
    <Card className="gap-0 border-border bg-secondary py-0">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Shield size={16} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rules</p>
            <p className="text-xs text-muted-foreground">Constraints</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary">
              <span className="text-xs text-muted-foreground">-</span>
              <span className="flex-1 text-sm text-foreground">{item}</span>
              <button
                aria-label="Remove"
                onClick={() => removeItem(i)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} className="text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add constraint..."
            className="text-sm"
          />
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={addItem}>
            <Plus size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
