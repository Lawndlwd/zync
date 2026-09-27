import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useConfirm, useToast } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { TextInput } from '../components/TextInput'
import { errorMessage } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { usePeople } from '../hooks/usePeople'
import { IconPlus, IconSearch } from '../icons'
import { type Memory, type MemoryFilter, type MemoryPatch, type MemoryScope, MEMORY_TYPES } from '../types/memory'
import { scopeName, TYPE_INFO } from './helpers'
import { MemoryList } from './MemoryList'
import { MemoryPanel } from './MemoryPanel'
import { PersonNoteRow } from './PersonNoteRow'
import { PersonPanel } from './PersonPanel'
import { PromptPreview } from './PromptPreview'

/**
 * What the AI remembers: people notes (who you are, who others are), and memories — rules,
 * preferences, habits and facts — global or for this workspace. All plain markdown files the AI
 * reads through zync's opencode plugin and writes as it learns; edit them here like any page.
 */
export function MemoryView() {
  const { ws = '' } = useParams()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const people = usePeople()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MemoryFilter>('all')
  const [err, setErr] = useState('')

  // Global memory has no file events (it lives outside the workspace): poll while the page is open.
  const global = useQuery({
    queryKey: ['memory', 'global'],
    queryFn: () => api.memories('global', ws),
    refetchInterval: 5000,
  })
  const local = useQuery({ queryKey: ['memory', 'workspace', ws], queryFn: () => api.memories('workspace', ws) })
  const notes = useQueries({
    queries: people.map((p) => ({
      queryKey: ['person-notes', p.id],
      queryFn: () => api.personNotes(p.id),
      refetchInterval: 5000,
    })),
  })

  const mParts = (params.get('m') ?? '').split(/:(.*)/s)
  const openScopeRaw = mParts[0] ?? ''
  const openScope: MemoryScope | '' = openScopeRaw === 'global' || openScopeRaw === 'workspace' ? openScopeRaw : ''
  const openFile = mParts[1] ?? ''
  const all = [...(local.data ?? []), ...(global.data ?? [])]
  const open = openFile ? all.find((m) => m.scope === openScope && m.file === openFile) : undefined
  const newParam = params.get('new')
  const newScope: MemoryScope | null = newParam === 'global' || newParam === 'workspace' ? newParam : null
  const person = people.find((p) => p.id === params.get('person'))

  const show = (next: { m?: string; new?: MemoryScope; person?: string }) =>
    setParams((p) => {
      for (const k of ['m', 'new', 'person']) p.delete(k)
      for (const [k, v] of Object.entries(next)) if (v) p.set(k, v)
      return p
    })
  const close = () => show({})

  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      setErr('')
      return await fn()
    } catch (caught) {
      const msg = errorMessage(caught)
      setErr(msg)
      toast(msg, 'bad')
      return undefined
    } finally {
      await qc.invalidateQueries({ queryKey: ['memory'] })
    }
  }

  const patch = (m: Memory, p: MemoryPatch) =>
    run(async () => {
      const next = await api.updateMemory(m.scope, ws, m.file, p)
      if (next.file !== m.file) show({ m: `${m.scope}:${next.file}` })
      return next
    })

  const remove = async (m: Memory) => {
    const ok = await confirm({
      title: 'Delete this memory?',
      body: (
        <>
          The AI stops knowing <b>{m.title}</b>. Its file <span className="mono-s">{m.file}</span> is deleted.
        </>
      ),
      confirmLabel: 'Delete memory',
      destructive: true,
    })
    if (!ok) return
    await run(async () => {
      if (open?.file === m.file && open.scope === m.scope) close()
      await api.deleteMemory(m.scope, ws, m.file)
      toast(`Deleted “${m.title}”`, 'quiet')
    })
  }

  const matches = (m: Memory) => {
    if (filter !== 'all' && m.type !== filter) return false
    const q = query.trim().toLowerCase()
    return !q || `${m.title}\n${m.description ?? ''}\n${m.body}`.toLowerCase().includes(q)
  }
  const shownLocal = (local.data ?? []).filter(matches)
  const shownGlobal = (global.data ?? []).filter(matches)
  const loading = global.isLoading || local.isLoading
  const panelOpen = !!open || !!newScope || !!person

  return (
    <div className={`board-view${panelOpen ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g24" style={{ maxWidth: 920 }}>
          <div className="col g16">
            <span className="mono muted">{ws} / memory</span>
            <h1 className="display">Memory</h1>
            <p className="lede">
              What the AI knows about <b>you</b>, the <b>people</b> you work with, and <b>how you work</b>. It reads
              this in every chat and job, and saves what it learns — tell it “remember…”, or write it yourself.
            </p>
          </div>

          <Card
            title="People"
            meta={
              <Link to={wsUrl(ws, 'people')} className="m link muted">
                Manage people →
              </Link>
            }
          >
            <div className="col">
              {people.map((p, i) => (
                <PersonNoteRow
                  key={p.id}
                  person={p}
                  people={people}
                  notes={notes[i]?.data?.notes}
                  active={person?.id === p.id}
                  onOpen={() => show({ person: p.id })}
                />
              ))}
            </div>
          </Card>

          <div className="row g12 wrap">
            <TextInput
              className="grow"
              style={{ minWidth: 220 }}
              icon={<IconSearch size={14} />}
              placeholder="Search memories…"
              aria-label="Search memories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" data-tour="new-memory" onClick={() => show({ new: 'global' })}>
              <IconPlus size={13} /> New memory
            </Button>
          </div>
          <Segmented<MemoryFilter>
            label="Type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              ...MEMORY_TYPES.map((t) => ({ value: t, label: `${TYPE_INFO[t].label}s` })),
            ]}
          />

          {loading ? (
            <div className="skel" style={{ height: 180 }} />
          ) : (
            <>
              <MemoryList
                title={scopeName('workspace', ws)}
                meta={`${ws}/.zync/memory`}
                items={shownLocal}
                total={local.data?.length ?? 0}
                openFile={openScope === 'workspace' ? openFile : undefined}
                onOpen={(m) => show({ m: `workspace:${m.file}` })}
                onDelete={(m) => void remove(m)}
                onNew={() => show({ new: 'workspace' })}
              />
              <MemoryList
                title={scopeName('global', ws)}
                meta=".zync/memory"
                items={shownGlobal}
                total={global.data?.length ?? 0}
                openFile={openScope === 'global' ? openFile : undefined}
                onOpen={(m) => show({ m: `global:${m.file}` })}
                onDelete={(m) => void remove(m)}
                onNew={() => show({ new: 'global' })}
              />
            </>
          )}

          <PromptPreview ws={ws} />
          {err && !panelOpen && <span className="help err">{err}</span>}
        </div>
      </div>

      {person && <PersonPanel key={person.id} ws={ws} person={person} people={people} onClose={close} />}
      {!person && open && (
        <MemoryPanel
          key={`${open.scope}:${open.file}`}
          ws={ws}
          memory={open}
          onPatch={(p) => patch(open, p)}
          onCreate={async () => {}}
          onClose={close}
          error={err}
          onDelete={() => void remove(open)}
        />
      )}
      {!person && !open && newScope && (
        <MemoryPanel
          key={`new:${newScope}`}
          ws={ws}
          draft={{ scope: newScope, title: '', type: 'preference', description: '', pinned: false, body: '' }}
          onPatch={async () => {}}
          onDelete={() => {}}
          onClose={close}
          error={err}
          onCreate={async (d) => {
            const m = await run(() =>
              api.createMemory(d.scope, ws, {
                title: d.title,
                type: d.type,
                description: d.description.trim() || undefined,
                pinned: d.pinned,
                body: d.body,
              }),
            )
            if (m) show({ m: `${m.scope}:${m.file}` })
          }}
        />
      )}
    </div>
  )
}
