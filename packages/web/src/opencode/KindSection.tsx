import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { TextButton } from '../components/TextButton'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { libraryUrl } from '../helpers/urls'
import { usePendingRestart } from '../hooks/usePendingRestart'
import { IconFile, IconFolder, IconSpark } from '../icons'
import type { LibraryItem } from '../types/opencode'
import { type KINDS } from './kinds'

export function KindSection({
  ws,
  spec,
  items,
  inline,
  loading,
}: {
  ws: string
  spec: (typeof KINDS)[number]
  items: LibraryItem[]
  inline: Array<{ name: string; description?: string }>
  loading: boolean
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [, markPending] = usePendingRestart()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const create = async () => {
    const n = name.trim()
    if (!n) return setAdding(false)
    try {
      const { path } = await api.createLibraryItem(spec.kind, n)
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      markPending()
      setAdding(false)
      setName('')
      toast(`Created ${spec.one} “${n}”`)
      void navigate(libraryUrl(ws, path))
    } catch (caught) {
      setErr(errorMessage(caught))
    }
  }

  return (
    <section className="card" aria-label={spec.title}>
      <div className="card-h">
        <span className="t">{spec.title}</span>
        <span className="m">{items.length + inline.length}</span>
      </div>
      <p className="small muted" style={{ margin: '0 0 8px' }}>
        {spec.help}{' '}
        <a className="link" href={spec.docs} target="_blank" rel="noreferrer">
          [Docs ↗]
        </a>
      </p>
      <div className="col">
        {loading && <div className="skel" style={{ height: 44 }} />}
        {items.map((i) => (
          <Link key={i.path} to={libraryUrl(ws, i.path)} className="oc-row">
            {spec.kind === 'skill' ? (
              <IconFolder size={14} />
            ) : spec.kind === 'agent' ? (
              <IconSpark size={14} />
            ) : (
              <IconFile size={14} />
            )}
            <span className="grow col" style={{ minWidth: 0 }}>
              <span className="oc-name">
                {spec.kind === 'command' ? `/${i.name}` : i.name}
                {i.builtin && <span className="label alt">zync</span>}
                {i.modified && <span className="label">edited</span>}
                {i.files?.length ? <span className="mono-s muted">+{i.files.length} files</span> : null}
              </span>
              <span className={`small trunc ${i.error ? 'danger-t' : 'muted'}`}>{i.error ?? i.description ?? '—'}</span>
            </span>
            <span className="mono-s muted">{i.path}</span>
          </Link>
        ))}
        {inline.map((i) => (
          <Link key={`inline:${i.name}`} to={libraryUrl(ws, 'opencode.json')} className="oc-row">
            <IconFile size={14} />
            <span className="grow col" style={{ minWidth: 0 }}>
              <span className="oc-name">
                {spec.kind === 'command' ? `/${i.name}` : i.name}
                <span className="label alt">in opencode.json</span>
              </span>
              <span className="small muted trunc">{i.description ?? '—'}</span>
            </span>
          </Link>
        ))}
        {!loading && !items.length && !inline.length && !adding && (
          <span className="small muted oc-empty">No {spec.title.toLowerCase()} yet.</span>
        )}
        {adding ? (
          <div className="col g6 oc-new">
            <TextInput
              compact
              mono
              autoFocus
              placeholder={
                spec.kind === 'command'
                  ? 'e.g. release-notes'
                  : spec.kind === 'agent'
                    ? 'e.g. reviewer'
                    : 'e.g. write-changelog'
              }
              aria-label={`New ${spec.one} name`}
              value={name}
              onChange={(e) => {
                setErr('')
                setName(e.target.value.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
                if (e.key === 'Escape') setAdding(false)
              }}
              onBlur={() => !name && setAdding(false)}
            />
            <span className={`help${err ? ' err' : ''}`}>
              {err || 'Lowercase letters, digits and dashes · Enter to create'}
            </span>
          </div>
        ) : (
          <TextButton className="oc-add" onClick={() => setAdding(true)}>
            [+] New {spec.one}
          </TextButton>
        )}
      </div>
    </section>
  )
}
