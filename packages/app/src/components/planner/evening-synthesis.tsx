import type { JournalResponse } from '@zync/shared/types'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useIdentity, useSaveJournal, useUpdateIdentity } from '@/hooks/useLifeOs'
import { useLifeOsStore } from '@/store/life-os'

const QUESTIONS = [
  // Integration
  { key: 'stuck', q: "After today, what feels most true about why you've been stuck?" },
  {
    key: 'enemy',
    q: 'What is the actual enemy? Name it clearly. Not circumstances. Not other people. The internal pattern or belief running the show.',
  },
  { key: 'alive_dead', q: 'When were you most alive today? When most dead?' },
  { key: 'protecting', q: 'What did you do today out of identity protection rather than genuine desire?' },
  // Compressed statements
  {
    key: 'compressed_anti_vision',
    q: 'Write a single sentence that captures what you refuse to let your life become. It should provoke an emotional response.',
  },
  {
    key: 'compressed_vision',
    q: "Write a single sentence that captures what you're building toward. Your vision MVP — expect it to evolve.",
  },
  // Three temporal lenses
  {
    key: 'one_year_lens',
    q: "What would have to be true in one year for you to know you've broken the old pattern? One concrete thing — proof of identity shift.",
  },
  { key: 'one_month', q: 'What would have to be true in one month for the one-year lens to remain possible?' },
  {
    key: 'daily_actions',
    q: "What are 2-3 actions you can timeblock tomorrow that the person you're becoming would simply do?",
  },
  // Identity
  {
    key: 'identity_update',
    q: 'Update your identity statement. Who are you becoming? "I am the type of person who..."',
  },
]

export function EveningSynthesis() {
  const { eveningStep, eveningAnswers, setEveningStep, setEveningAnswer, resetEvening } = useLifeOsStore()
  const navigate = useNavigate()
  const saveJournal = useSaveJournal()
  const updateIdentity = useUpdateIdentity()
  const { data: identity } = useIdentity()
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [startTime])

  // Pre-fill identity question with current statement
  useEffect(() => {
    if (identity?.statement && !eveningAnswers.identity_update) {
      setEveningAnswer('identity_update', identity.statement)
    }
  }, [identity])

  const isLastQuestion = eveningStep === QUESTIONS.length - 1
  const isSummary = eveningStep === QUESTIONS.length
  const currentQ = QUESTIONS[eveningStep]

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const complete = () => {
    const today = new Date().toISOString().slice(0, 10)
    const responses: JournalResponse[] = QUESTIONS.map((q) => ({
      questionKey: q.key,
      question: q.q,
      answer: eveningAnswers[q.key] || '',
    }))

    // Update identity if changed
    const newIdentity = eveningAnswers.identity_update
    if (newIdentity && newIdentity !== identity?.statement) {
      updateIdentity.mutate(newIdentity)
    }

    saveJournal.mutate(
      { date: today, type: 'evening', responses, completedAt: new Date().toISOString() },
      {
        onSuccess: () => {
          resetEvening()
          navigate('/s/game-board')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Moon size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Evening Synthesis</h2>
            <p className="text-xs text-muted-foreground">Reflect & plan tomorrow</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} />
            {formatTime(elapsed)}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/s/game-board')}>
            Back
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1.5">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < eveningStep ? 'bg-primary' : i === eveningStep ? 'bg-primary/60' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Question or Summary */}
      {isSummary ? (
        <Card className="gap-0 border-primary/20 bg-primary/[0.03] py-0">
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Evening Summary</h3>
            <div className="space-y-4">
              {QUESTIONS.map((q) => (
                <div key={q.key}>
                  <p className="text-xs font-medium text-muted-foreground">{q.q}</p>
                  <p className="mt-1 text-sm text-foreground">{eveningAnswers[q.key] || '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setEveningStep(eveningStep - 1)}>
                <ArrowLeft size={14} className="mr-1" /> Back
              </Button>
              <Button onClick={complete} disabled={saveJournal.isPending} className="bg-primary hover:bg-primary/90">
                <CheckCircle2 size={16} className="mr-2" />
                Complete Synthesis (+100 XP)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 border-border bg-secondary py-0">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Question {eveningStep + 1} of {QUESTIONS.length}
            </p>
            <h3 className="mb-4 text-lg font-medium text-foreground">{currentQ.q}</h3>
            <Textarea
              value={eveningAnswers[currentQ.key] || ''}
              onChange={(e) => setEveningAnswer(currentQ.key, e.target.value)}
              placeholder="Reflect honestly..."
              rows={6}
              className="text-sm"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => (eveningStep > 0 ? setEveningStep(eveningStep - 1) : navigate('/s/game-board'))}
              >
                <ArrowLeft size={14} className="mr-1" /> {eveningStep > 0 ? 'Back' : 'Exit'}
              </Button>
              <Button onClick={() => setEveningStep(eveningStep + 1)}>
                {isLastQuestion ? 'Review' : 'Next'} <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
