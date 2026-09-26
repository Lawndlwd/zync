import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from './api'

export function Home() {
  const { data, isLoading, error } = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces })
  if (isLoading) return <div className="center">Loading…</div>
  if (error) return <div className="center error">{String(error)}</div>
  if (data?.length) {
    let last: string | null = null
    try {
      last = localStorage.getItem('zync:lastWorkspace')
    } catch {}
    const target = data.find((w) => w.name === last) ?? data[0]
    return <Navigate to={`/w/${encodeURIComponent(target.name)}/files`} replace />
  }
  return (
    <div className="center">
      <h2>No workspaces yet</h2>
      <p>A workspace is a folder in the workspaces root. Create one to start.</p>
      <NewWorkspaceForm />
    </div>
  )
}

export function NewWorkspaceForm({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const qc = useQueryClient()
  const navigate = useNavigate()
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          const ws = await api.createWorkspace(name)
          await qc.invalidateQueries({ queryKey: ['workspaces'] })
          onDone?.()
          navigate(`/w/${encodeURIComponent(ws.name)}/files`)
        } catch (e) {
          setErr(String((e as Error).message))
        }
      }}
    >
      <input autoFocus placeholder="workspace name" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim()}>
        Create
      </button>
      {err && <span className="error">{err}</span>}
    </form>
  )
}
