import type { IdentityStatement } from '@zync/shared/types'
import { Check, Fingerprint, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useUpdateIdentity } from '@/hooks/useLifeOs'

export function IdentityDisplay({ identity }: { identity?: IdentityStatement | null }) {
  const [editing, setEditing] = useState(false)
  const [statement, setStatement] = useState('')
  const updateIdentity = useUpdateIdentity()

  const startEdit = () => {
    setStatement(identity?.statement || '')
    setEditing(true)
  }

  const save = () => {
    if (!statement.trim()) return
    updateIdentity.mutate(statement.trim(), { onSuccess: () => setEditing(false) })
  }

  return (
    <Card className="gap-0 border-border bg-secondary py-0">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint size={18} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Identity Statement</h3>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} aria-label="Edit identity">
              <Pencil size={13} />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex gap-2">
            <Input
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="I am the type of person who..."
              className="text-sm"
              autoFocus
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={save}>
              <Check size={14} />
            </Button>
          </div>
        ) : (
          <p className="text-base italic leading-relaxed text-primary/80">
            "{identity?.statement || 'I am the type of person who...'}"
          </p>
        )}
      </CardContent>
    </Card>
  )
}
