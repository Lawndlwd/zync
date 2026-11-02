import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useToast } from '../components/Dialog'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { fromUnits, parseAmount } from '../helpers/training'
import type { Units } from '../types/training'

/** Log today's body weight in one line (Training/.body.jsonl; the last entry of a day wins). */
export function BodyWeightLog({ ws, units }: { ws: string; units: Units }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const value = parseAmount(text)

  const log = async () => {
    if (!value || busy) return
    setBusy(true)
    try {
      await api.logBodyWeight(ws, fromUnits(value, units))
      setText('')
      toast(`Body weight logged: ${value} ${units}`, 'quiet')
      await qc.invalidateQueries({ queryKey: ['training', ws, 'progress'] })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Body weight" meta="today">
      <div className="row g8">
        <TextInput
          compact
          inputMode="decimal"
          value={text}
          placeholder={units === 'kg' ? '78.4' : '172.8'}
          aria-label={`Body weight in ${units}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void log()
          }}
        />
        <span className="mono-s muted">{units}</span>
        <Button size="sm" busy={busy} disabled={!value} onClick={() => void log()}>
          Log
        </Button>
      </div>
    </Card>
  )
}
