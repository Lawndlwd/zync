import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { api } from '../api'
import { TextButton } from '../components/TextButton'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { libraryUrl } from '../helpers/urls'
import { IconFile, IconPlus } from '../icons'

export function SkillFiles({
  ws,
  root,
  current,
  files,
  onAdded,
}: {
  ws: string
  root: string
  current: string
  files: string[]
  onAdded: () => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const all = [`${root}/SKILL.md`, ...files]

  const add = async () => {
    const n = name.trim().replace(/^\/+/, '')
    if (!n) return setAdding(false)
    try {
      await api.saveLibraryFile(`${root}/${n}`, '')
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      onAdded()
      setAdding(false)
      setName('')
      void navigate(libraryUrl(ws, `${root}/${n}`))
    } catch (caught) {
      setErr(errorMessage(caught))
    }
  }

  return (
    <nav className="oc-files col" aria-label="Skill files">
      <span className="mh mono-s muted">Files</span>
      {all.map((f) => (
        <Link key={f} to={libraryUrl(ws, f)} className={`oc-file${f === current ? ' on' : ''}`}>
          <IconFile size={13} />
          <span className="trunc">{f.slice(root.length + 1)}</span>
        </Link>
      ))}
      {adding ? (
        <div className="col g4" style={{ padding: '4px 0' }}>
          <TextInput
            compact
            mono
            autoFocus
            placeholder="reference.md"
            aria-label="New file name"
            value={name}
            onChange={(e) => {
              setErr('')
              setName(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
              if (e.key === 'Escape') setAdding(false)
            }}
            onBlur={() => !name && setAdding(false)}
          />
          {err && <span className="help err">{err}</span>}
        </div>
      ) : (
        <TextButton className="oc-add" onClick={() => setAdding(true)}>
          <IconPlus size={12} /> Add file
        </TextButton>
      )}
    </nav>
  )
}
