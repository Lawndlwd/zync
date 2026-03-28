import type { DailyLever } from '@zync/shared/types'
import { Check, Circle, Gamepad2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCreateDailyLever, useDeleteDailyLever, useToggleDailyLever } from '@/hooks/useLifeOs'

export function DailyLeversPanel({ levers }: { levers: DailyLever[] }) {
  const [newTitle, setNewTitle] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const createLever = useCreateDailyLever()
  const toggleLever = useToggleDailyLever()
  const deleteLever = useDeleteDailyLever()
  const allDone = levers.length > 0 && levers.every((l) => l.completed)

  const addLever = () => {
    if (!newTitle.trim()) return
    createLever.mutate({ title: newTitle.trim(), date: today })
    setNewTitle('')
  }

  return (
    <Card
      className={`gap-0 py-0 ${allDone ? 'border-emerald-600/20 dark:border-emerald-400/20 bg-emerald-600/[0.03] dark:bg-emerald-400/[0.03]' : 'border-border bg-secondary'}`}
    >
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${allDone ? 'bg-emerald-600/20 dark:bg-emerald-400/20' : 'bg-muted'}`}
            >
              {allDone ? (
                <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Gamepad2 size={18} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daily Quests</h3>
              <p className="text-xs text-muted-foreground">
                {allDone
                  ? 'All quests complete!'
                  : `${levers.filter((l) => l.completed).length}/${levers.length} completed`}
              </p>
            </div>
          </div>
          {allDone && (
            <span className="rounded-full bg-emerald-600/15 dark:bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +150 XP Bonus
            </span>
          )}
        </div>

        <div className="space-y-2">
          {levers.map((lever) => (
            <div
              key={lever.id}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                lever.completed ? 'bg-emerald-600/[0.06] dark:bg-emerald-400/[0.06]' : 'bg-secondary hover:bg-accent'
              }`}
            >
              <button aria-label="Toggle quest" onClick={() => toggleLever.mutate(lever.id)} className="shrink-0">
                {lever.completed ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500">
                    <Check size={14} className="text-white" />
                  </div>
                ) : (
                  <Circle size={24} className="text-muted-foreground hover:text-foreground" />
                )}
              </button>
              <span
                className={`flex-1 text-sm ${lever.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {lever.title}
              </span>
              {lever.completed && <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">+50 XP</span>}
              <button
                aria-label="Remove"
                onClick={() => deleteLever.mutate(lever.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {levers.length < 3 && (
          <div className="mt-3 flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLever()}
              placeholder="Add daily quest..."
              className="text-sm"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={addLever}>
              <Plus size={14} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
