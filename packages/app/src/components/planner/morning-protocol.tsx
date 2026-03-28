import type { JournalResponse } from '@zync/shared/types'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useSaveJournal } from '@/hooks/useLifeOs'
import { useLifeOsStore } from '@/store/life-os'

const QUESTIONS = [
  // Section A: Uncover Current Pain
  { key: 'tolerate', q: 'What dull dissatisfaction have you learned to tolerate?' },
  {
    key: 'complain',
    q: 'What do you complain about repeatedly but never change? What does your behavior reveal you actually want?',
  },
  {
    key: 'truth_unbearable',
    q: 'What truth about your current life would be unbearable to admit to someone you deeply respect?',
  },
  // Section B: Anti-Vision
  { key: 'anti_tuesday', q: 'If nothing changes in 5 years, describe your average Tuesday in detail.' },
  {
    key: 'anti_ten_year',
    q: "Now do it for ten years. What opportunities closed? Who gave up on you? What do people say about you when you're not around?",
  },
  {
    key: 'end_of_life',
    q: "You're at the end of your life. You lived the safe version. You never broke the pattern. What was the cost? What did you never let yourself feel, try, or become?",
  },
  {
    key: 'who_living_it',
    q: 'Who in your life is already living the future you just described — five, ten, twenty years ahead on the same trajectory? What emotion arises?',
  },
  {
    key: 'identity_cost',
    q: 'What identity would you have to give up to actually change? Complete: "I am the type of person who..." — what would it cost socially?',
  },
  {
    key: 'embarrassing_reason',
    q: "What is the most embarrassing reason you haven't changed? The answer that makes you sound weak, scared, or lazy rather than reasonable.",
  },
  {
    key: 'self_protection',
    q: 'If your current behavior is a form of self-protection, what exactly are you protecting? What is that protection costing you?',
  },
  // Section C: Vision
  {
    key: 'ideal_tuesday',
    q: "If you could snap your fingers and be living a different life in 3 years — not what's realistic, what you actually want — what does an average Tuesday look like?",
  },
  {
    key: 'identity',
    q: 'What would you have to believe about yourself for that life to feel natural rather than forced? Complete: "I am the type of person who..."',
  },
  { key: 'one_thing', q: 'What is the ONE thing you would do this week if you were already that person?' },
]

export function MorningProtocol() {
  const { morningStep, morningAnswers, setMorningStep, setMorningAnswer, resetMorning } = useLifeOsStore()
  const navigate = useNavigate()
  const saveJournal = useSaveJournal()
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [startTime])

  const isLastQuestion = morningStep === QUESTIONS.length - 1
  const isSummary = morningStep === QUESTIONS.length
  const currentQ = QUESTIONS[morningStep]

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const complete = () => {
    const today = new Date().toISOString().slice(0, 10)
    const responses: JournalResponse[] = QUESTIONS.map((q) => ({
      questionKey: q.key,
      question: q.q,
      answer: morningAnswers[q.key] || '',
    }))
    saveJournal.mutate(
      { date: today, type: 'morning', responses, completedAt: new Date().toISOString() },
      {
        onSuccess: () => {
          resetMorning()
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
            <Sun size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Morning Protocol</h2>
            <p className="text-xs text-muted-foreground">Psychological excavation</p>
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
              i < morningStep ? 'bg-primary' : i === morningStep ? 'bg-primary/60' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Question or Summary */}
      {isSummary ? (
        <Card className="gap-0 border-primary/20 bg-primary/[0.03] py-0">
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Protocol Summary</h3>
            <div className="space-y-4">
              {QUESTIONS.map((q) => (
                <div key={q.key}>
                  <p className="text-xs font-medium text-muted-foreground">{q.q}</p>
                  <p className="mt-1 text-sm text-foreground">{morningAnswers[q.key] || '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setMorningStep(morningStep - 1)}>
                <ArrowLeft size={14} className="mr-1" /> Back
              </Button>
              <Button onClick={complete} disabled={saveJournal.isPending} className="bg-primary hover:bg-primary/90">
                <CheckCircle2 size={16} className="mr-2" />
                Complete Protocol (+100 XP)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 border-border bg-secondary py-0">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Question {morningStep + 1} of {QUESTIONS.length}
            </p>
            <h3 className="mb-4 text-lg font-medium text-foreground">{currentQ.q}</h3>
            <Textarea
              value={morningAnswers[currentQ.key] || ''}
              onChange={(e) => setMorningAnswer(currentQ.key, e.target.value)}
              placeholder="Take your time... write honestly."
              rows={6}
              className="text-sm"
              autoFocus
            />
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => (morningStep > 0 ? setMorningStep(morningStep - 1) : navigate('/s/game-board'))}
              >
                <ArrowLeft size={14} className="mr-1" /> {morningStep > 0 ? 'Back' : 'Exit'}
              </Button>
              <Button onClick={() => setMorningStep(morningStep + 1)}>
                {isLastQuestion ? 'Review' : 'Next'} <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
