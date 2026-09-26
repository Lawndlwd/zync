import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from './api'
import { Button } from './components/Button'
import { Field, TextInput } from './components/Field'
import { readPref } from './shell/context'

export function Home() {
  const { data, isLoading, error } = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  if (data?.length) {
    const last = readPref('zync:lastWorkspace', '')
    const target = data.find((w) => w.name === last) ?? data[0]
    return <Navigate to={`/w/${encodeURIComponent(target.name)}/overview`} replace />
  }
  return (
    <div className="z app-root welcome">
      <div className="welcome-in col g24">
        <div className="wordmark">
          <i />
          ZYNC
        </div>
        {isLoading ? (
          <div className="skel" style={{ height: 56, width: 320 }} />
        ) : error ? (
          <p className="lede danger-t">{(error as Error).message}</p>
        ) : (
          <>
            <div className="col g12">
              <h1 className="display">Start a workspace</h1>
              <p className="lede">
                A workspace is a <b>folder</b> of plain files. Boards, jobs and the AI all work inside it.
              </p>
            </div>
            <section className="card plain">
              <NewWorkspaceForm />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function NewWorkspaceForm() {
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
          navigate(`/w/${encodeURIComponent(ws.name)}/overview`)
        } catch (e) {
          setErr((e as Error).message)
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
