import type { JournalResponse } from '@zync/shared/types'
import { ChevronDown, ChevronUp, Footprints, Save } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useIdentity, useSaveJournal } from '@/hooks/useLifeOs'

const WALKING_QUESTIONS = [
  { key: 'stop_needing', q: 'What would change if I stopped needing people to see me as [my identity]?' },
  { key: 'aliveness_safety', q: 'Where in my life am I trading aliveness for safety?' },
  {
    key: 'smallest_version',
    q: "What's the smallest version of the person I want to become that I could be tomorrow?",
  },
]

export function WalkingReflectionCard() {
  const [expanded, setExpanded] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const saveJournal = useSaveJournal()
  const { data: identity } = useIdentity()
  const hasAnswers = Object.values(answers).some((a) => a.trim())

  const save = () => {
    const today = new Date().toISOString().slice(0, 10)
    const responses: JournalResponse[] = WALKING_QUESTIONS.filter((q) => answers[q.key]?.trim()).map((q) => ({
      questionKey: q.key,
      question: q.q,
      answer: answers[q.key].trim(),
    }))
    if (!responses.length) return
    saveJournal.mutate(
      { date: today, type: 'walking', responses, completedAt: new Date().toISOString() },
      {
        onSuccess: () => {
          setAnswers({})
          setExpanded(false)
        },
      },
    )
  }

  const personalizeQuestion = (q: string) => {
    if (identity?.statement) {
      return q.replace('[my identity]', `"${identity.statement}"`)
    }
    return q.replace('[my identity]', 'my current identity')
  }

  return (
    <Card className="gap-0 border-border bg-secondary py-0">
      <CardContent className="p-4">
        <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Footprints size={18} className="text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Walking Reflections</h3>
              <p className="text-xs text-muted-foreground">Flexible-timing transition questions</p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {WALKING_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p className="mb-2 text-sm font-medium text-muted-foreground">{personalizeQuestion(q.q)}</p>
                <Textarea
                  value={answers[q.key] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  placeholder="Reflect..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                onClick={save}
                disabled={!hasAnswers || saveJournal.isPending}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Save size={14} className="mr-2" />
                Save Reflections
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
