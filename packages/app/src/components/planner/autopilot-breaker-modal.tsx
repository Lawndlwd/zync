import type { AutopilotBreaker } from '@zync/shared/types'
import { AlertTriangle, Pen, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAutopilotBreakers, useSaveJournal } from '@/hooks/useLifeOs'

function getCurrentHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function getTodayKey(id: string) {
  return `breaker-dismissed-${id}-${new Date().toISOString().slice(0, 10)}`
}

export function AutopilotBreakerModal() {
  const { data: breakers } = useAutopilotBreakers()
  const saveJournal = useSaveJournal()
  const [activeBreaker, setActiveBreaker] = useState<AutopilotBreaker | null>(null)
  const [reflecting, setReflecting] = useState(false)
  const [answer, setAnswer] = useState('')

  const checkBreakers = useCallback(() => {
    if (!breakers?.length || activeBreaker) return
    const now = getCurrentHHMM()
    for (const b of breakers) {
      if (!b.enabled) continue
      if (b.time !== now) continue
      if (sessionStorage.getItem(getTodayKey(b.id))) continue
      setActiveBreaker(b)
      break
    }
  }, [breakers, activeBreaker])

  useEffect(() => {
    checkBreakers()
    const id = setInterval(checkBreakers, 60_000)
    return () => clearInterval(id)
  }, [checkBreakers])

  const dismiss = () => {
    if (activeBreaker) sessionStorage.setItem(getTodayKey(activeBreaker.id), '1')
    setActiveBreaker(null)
    setReflecting(false)
    setAnswer('')
  }

  const saveReflection = () => {
    if (!activeBreaker || !answer.trim()) return
    const today = new Date().toISOString().slice(0, 10)
    saveJournal.mutate(
      {
        date: today,
        type: 'breaker',
        responses: [
          { questionKey: `breaker_${activeBreaker.id}`, question: activeBreaker.question, answer: answer.trim() },
        ],
        completedAt: new Date().toISOString(),
      },
      { onSuccess: dismiss },
    )
  }

  if (!activeBreaker) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-primary/20 bg-secondary p-8 shadow-2xl shadow-primary/10">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <AlertTriangle size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Autopilot Breaker</h2>
            <p className="text-xs text-muted-foreground">{activeBreaker.time} — pause and reflect</p>
          </div>
        </div>

        <p className="text-xl font-medium text-foreground leading-relaxed mb-6">{activeBreaker.question}</p>

        {reflecting ? (
          <div className="space-y-4">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Take a moment to reflect honestly..."
              rows={4}
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setReflecting(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={saveReflection}
                disabled={!answer.trim() || saveJournal.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Save Reflection
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button variant="ghost" onClick={dismiss} className="flex-1">
              Dismiss
            </Button>
            <Button
              onClick={() => setReflecting(true)}
              className="flex-1 bg-primary/15 text-primary hover:bg-primary/25"
            >
              <Pen size={14} className="mr-2" />
              Reflect
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
