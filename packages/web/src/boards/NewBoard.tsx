import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { boardUrl, wsUrl } from '../helpers/urls'
import { presetLabel, PRESETS } from './presets'

export function NewBoard({ ws }: { ws: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('standard')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="card plain new-board"
      data-tour="new-board"
      style={{ gap: 14 }}
      aria-label="Create board"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          const b = await api.createBoard(ws, name.trim(), { columns: PRESETS[preset] })
          await qc.invalidateQueries({ queryKey: ['boards', ws] })
          void navigate(boardUrl(ws, b.path))
        } catch (caught) {
          setErr(errorMessage(caught))
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span className="t">[+] New board</span>
        <span className="m">Creates a folder</span>
      </div>
      <div className="row g12 wrap" style={{ alignItems: 'flex-end' }}>
        <Field label="Board name (folder)" className="grow" style={{ minWidth: 220 }}>
          <TextInput
            placeholder="e.g. Sprint 2"
            value={name}
            invalid={!!err}
            onChange={(e) => {
              setName(e.target.value)
              setErr('')
            }}
          />
        </Field>
        <Field label="Columns" style={{ width: 360, maxWidth: '100%' }}>
          <Select
            ariaLabel="Columns"
            value={preset}
            options={Object.keys(PRESETS).map((k) => ({ value: k, label: presetLabel(k), text: presetLabel(k) }))}
            onChange={setPreset}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" busy={busy} disabled={!name.trim()}>
          Create board
        </Button>
      </div>
      {err ? (
        <span className="help err">{err}</span>
      ) : (
        <span className="help mono-s">
          → {ws}/{name.trim() || '…'}/ · columns are stored in .board.json ·{' '}
          <Link to={wsUrl(ws, 'people')} className="link">
            [People ↗]
          </Link>
        </span>
      )}
    </form>
  )
}
