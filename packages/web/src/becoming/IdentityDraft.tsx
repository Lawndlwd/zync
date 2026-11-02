import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { IconButton } from '../components/IconButton'
import { Select } from '../components/Select'
import { TagInput } from '../components/TagInput'
import { TextInput } from '../components/TextInput'
import { TitleInput } from '../components/TitleInput'
import { parseAll, parseSignal, parseWhen, STAGE_LABEL, STAGES, WORKOUT_SIGNAL } from '../helpers/becoming'
import { errorMessage } from '../helpers/format'
import { usePanelEscape } from '../hooks/usePanelEscape'
import { IconCross } from '../icons'
import type { IdentityInput, Stage } from '../types/becoming'

type Draft = { statement: string; action: string; small: string; when: string; signals: string[]; stage: Stage }

/** A new identity, written by hand: the page is created on "Create". */
export function IdentityDraft({
  ws,
  stage,
  onCreated,
  onClose,
}: {
  ws: string
  stage: Stage
  onCreated: (file: string) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>({ statement: 'I am ', action: '', small: '', when: '', signals: [], stage })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))

  const create = async () => {
    if (busy) return
    const signals = parseAll(d.signals, parseSignal)
    const when = d.when.trim() ? parseWhen(d.when) : undefined
    if ('bad' in signals) return setError(`Can’t read the signal “${signals.bad}”.`)
    if (when === null) return setError('When is morning, midday, evening or a time like 07:30.')
    if (!d.statement.trim() || !d.action.trim()) return setError('Say who you want to become and the action.')
    const input: IdentityInput = {
      statement: d.statement.trim(),
      action: d.action.trim(),
      stage: d.stage,
      signals: signals.ok.length ? signals.ok : [{ manual: true }],
      ...(d.small.trim() ? { small: d.small.trim() } : {}),
      ...(when ? { when } : {}),
    }
    setBusy(true)
    try {
      const made = await api.createIdentity(ws, input)
      await qc.invalidateQueries({ queryKey: ['becoming', ws] })
      onCreated(made.file)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  usePanelEscape(onClose, { onSubmit: () => void create() })

  return (
    <aside className="panel card-panel" aria-label="New identity">
      <div className="panel-h">
        <span className="mono muted trunc">Becoming / New identity</span>
        <span className="grow" />
        <IconButton small label="Close (Esc)" onClick={onClose}>
          <IconCross size={14} sw={1.5} />
        </IconButton>
      </div>
      <div className="panel-body">
        <div className="doc card-doc in-panel col g16">
          <TitleInput
            autoFocus
            className="doc-title"
            value={d.statement}
            aria-label="Identity statement"
            onChange={(e) => set({ statement: e.target.value })}
          />
          <div className="kv" style={{ gridTemplateColumns: '84px minmax(0, 1fr)', gap: '8px 12px' }}>
            <span className="k">action</span>
            <TextInput
              compact
              value={d.action}
              placeholder="Write 300 words"
              aria-label="action"
              onChange={(e) => set({ action: e.target.value })}
            />
            <span className="k">small</span>
            <TextInput
              compact
              value={d.small}
              placeholder="One sentence"
              aria-label="small"
              onChange={(e) => set({ small: e.target.value })}
            />
            <span className="k">when</span>
            <TextInput
              compact
              value={d.when}
              placeholder="morning · midday · evening · 07:30"
              aria-label="when"
              onChange={(e) => set({ when: e.target.value })}
            />
            <span className="k" style={{ alignSelf: 'start', paddingTop: 4 }}>
              signals
            </span>
            <TagInput
              ariaLabel="signals"
              variant="tag"
              addLabel="+ signal"
              placeholder="files: Writing/ · event: run · card: #essay · workout"
              suggestions={[WORKOUT_SIGNAL]}
              values={d.signals}
              onChange={(signals) => set({ signals })}
            />
            <span className="k">stage</span>
            <Select
              compact
              ariaLabel="stage"
              value={d.stage}
              options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
              onChange={(s) => set({ stage: s })}
            />
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            No signal means you vote by hand. Zync sees files you edit, calendar events, cards that reach Done and
            workouts logged in Training.
          </p>
          {error && <span className="help err">{error}</span>}
        </div>
      </div>
      <div className="row between panel-f">
        <span className="mono-s muted">
          <span className="kbd">⌘↵</span> create · <span className="kbd">Esc</span> cancel
        </span>
        <Button variant="primary" size="sm" busy={busy} onClick={() => void create()}>
          Create identity
        </Button>
      </div>
    </aside>
  )
}
