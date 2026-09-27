import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'

export function NewWorkspaceForm() {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <form
      className="row g12 wrap"
      style={{ alignItems: 'flex-end' }}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          const ws = await api.createWorkspace(name)
          await qc.invalidateQueries({ queryKey: ['workspaces'] })
          void navigate(`/w/${encodeURIComponent(ws.name)}/overview`)
        } catch (caught) {
          setErr(errorMessage(caught))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="Workspace name (folder)" error={err} className="grow" style={{ minWidth: 220 }}>
        <TextInput
          autoFocus
          placeholder="e.g. personal"
          value={name}
          invalid={!!err}
          onChange={(e) => {
            setName(e.target.value)
            setErr('')
          }}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" busy={busy} disabled={!name.trim()}>
        Create workspace
      </Button>
    </form>
  )
}
