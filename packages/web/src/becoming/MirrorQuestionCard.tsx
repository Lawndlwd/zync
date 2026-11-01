import { useState } from 'react'

import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { identityName } from '../helpers/becoming'
import { capitalize } from '../helpers/format'
import type { MirrorQuestion } from '../types/becoming'

/** One of the week's three questions, answered in place (a tap, or a line of text). */
export function MirrorQuestionCard({
  q,
  n,
  who,
  onAnswer,
}: {
  q: MirrorQuestion
  n: number
  who?: string | undefined
  onAnswer: (answer: string) => Promise<unknown>
}) {
  const [text, setText] = useState(q.answer ?? '')
  const done = q.answer !== undefined
  const label = `${String(n + 1).padStart(2, '0')}${who ? ` · ${capitalize(identityName(who))}` : ''}`
  return (
    <div className={`q${done ? ' done' : ''}`}>
      <div className="row between">
        <span className="mono-s muted">{label}</span>
        {done && <span className="st st-ok">✓ Answered</span>}
      </div>
      <p className="h3" style={{ margin: 0 }}>
        {q.q}
      </p>
      {q.options.length > 0 ? (
        <div className="row g8 wrap">
          {q.options.map((o, i) => (
            <Button
              key={o}
              size="sm"
              variant={q.answer === o ? 'primary' : i === 0 && !done ? 'soft' : 'ghost'}
              aria-pressed={q.answer === o}
              onClick={() => void onAnswer(q.answer === o ? '' : o)}
            >
              {q.answer === o ? `✓ ${o}` : o}
            </Button>
          ))}
        </div>
      ) : (
        <div className="row g8">
          <TextInput
            className="grow"
            value={text}
            placeholder="Your answer"
            aria-label="Your answer"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onAnswer(text)
            }}
          />
          <Button size="sm" disabled={text.trim() === (q.answer ?? '')} onClick={() => void onAnswer(text)}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
