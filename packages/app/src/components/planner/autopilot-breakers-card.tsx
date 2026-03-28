import { AlertTriangle, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  useAutopilotBreakers,
  useCreateAutopilotBreaker,
  useDeleteAutopilotBreaker,
  useUpdateAutopilotBreaker,
} from '@/hooks/useLifeOs'

export function AutopilotBreakersCard() {
  const { data: breakers = [] } = useAutopilotBreakers()
  const createBreaker = useCreateAutopilotBreaker()
  const updateBreaker = useUpdateAutopilotBreaker()
  const deleteBreaker = useDeleteAutopilotBreaker()
  const [newTime, setNewTime] = useState('12:00')
  const [newQuestion, setNewQuestion] = useState('')
  const [adding, setAdding] = useState(false)

  const addBreaker = () => {
    if (!newQuestion.trim()) return
    createBreaker.mutate({ time: newTime, question: newQuestion.trim() })
    setNewQuestion('')
    setAdding(false)
  }

  return (
    <Card className="gap-0 border-primary/10 bg-secondary py-0">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <AlertTriangle size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Autopilot Breakers</h3>
              <p className="text-xs text-muted-foreground">Scheduled interruptions to snap you awake</p>
            </div>
          </div>
          {!adding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdding(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Add breaker"
            >
              <Plus size={14} />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {breakers.map((b) => (
            <div
              key={b.id}
              className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <button
                onClick={() => updateBreaker.mutate({ id: b.id, enabled: !b.enabled })}
                className="mt-0.5 flex h-6 w-14 shrink-0 items-center justify-center rounded bg-secondary text-xs font-mono transition-colors"
                style={{ opacity: b.enabled ? 1 : 0.4 }}
              >
                <Clock size={10} className="mr-1 text-muted-foreground" />
                {b.time}
              </button>
              <p className={`flex-1 text-sm leading-snug ${b.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {b.question}
              </p>
              <button
                aria-label="Remove"
                onClick={() => deleteBreaker.mutate(b.id)}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {adding && (
          <div className="mt-3 space-y-2 rounded-lg bg-card border border-border p-3">
            <div className="flex gap-2">
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-28 text-sm"
              />
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="What question should interrupt you?"
                className="flex-1 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addBreaker()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false)
                  setNewQuestion('')
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={addBreaker} disabled={!newQuestion.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
