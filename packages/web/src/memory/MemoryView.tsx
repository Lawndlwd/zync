import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  api,
  MEMORY_TYPES,
  type Memory,
  type MemoryPatch,
  type MemoryScope,
  type MemoryType,
  type Person,
} from '../api'
import { usePeople } from '../boards/shared'
import { Button, IconButton } from '../components/Button'
import { Segmented } from '../components/Controls'
import { useConfirm, useToast } from '../components/Dialog'
import { TextInput } from '../components/Field'
import { IconChevDown, IconChevRight, IconPin, IconPlus, IconSearch, IconTrash } from '../icons'
import { wsUrl } from '../shell/context'
import { Card, PersonAvatar } from '../ui'
import { MemoryPanel, scopeName, TYPE_INFO } from './MemoryPanel'
import { PersonPanel } from './PersonPanel'

type Filter = 'all' | MemoryType

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
  const [filter, setFilter] = useState<Filter>('all')
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

  const [openScope, openFile] = (params.get('m') ?? '').split(/:(.*)/s) as [MemoryScope | '', string]
  const all = [...(local.data ?? []), ...(global.data ?? [])]
  const open = openFile ? all.find((m) => m.scope === openScope && m.file === openFile) : undefined
  const newScope = params.get('new') as MemoryScope | null
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
    } catch (e) {
      setErr((e as Error).message)
      toast((e as Error).message, 'bad')
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
                <PersonRow
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
            <Button variant="primary" onClick={() => show({ new: 'global' })}>
              <IconPlus size={13} /> New memory
            </Button>
          </div>
          <Segmented<Filter>
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

function PersonRow({
  person: p,
  people,
  notes,
  active,
  onOpen,
}: {
  person: Person
  people: Person[]
  notes?: string
  active: boolean
  onOpen: () => void
}) {
  const role = p.id === 'me' ? 'About you' : p.id === 'ai' ? 'How the AI should work' : `@${p.id}`
  const first = notes
    ?.split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean)
  return (
    <button
      type="button"
      className={`lr row-link${active ? ' hl' : ''}`}
      onClick={onOpen}
      style={{ textAlign: 'left' }}
    >
      <PersonAvatar id={p.id} people={people} size="l" />
      <span className="col grow" style={{ minWidth: 0 }}>
        <span className="row g8">
          <b style={{ fontWeight: 500 }}>{p.name}</b>
          <span className="mono-s muted">{role}</span>
        </span>
        <span className={`small trunc${first ? '' : ' muted'}`}>{first ?? 'No notes yet — add some'}</span>
      </span>
      <IconChevRight />
    </button>
  )
}

function MemoryList({
  title,
  meta,
  items,
  total,
  openFile,
  onOpen,
  onDelete,
  onNew,
}: {
  title: string
  meta: string
  items: Memory[]
  total: number
  openFile?: string
  onOpen: (m: Memory) => void
  onDelete: (m: Memory) => void
  onNew: () => void
}) {
  return (
    <Card title={`${title} · ${total}`} meta={meta}>
      <div className="col">
        {items.map((m) => (
          <div key={m.file} className={`lr row-link mem-row${openFile === m.file ? ' hl' : ''}`}>
            <button
              type="button"
              className="row g10 grow"
              style={{ textAlign: 'left', alignItems: 'flex-start', minWidth: 0 }}
              onClick={() => onOpen(m)}
            >
              <span className="col grow g4" style={{ minWidth: 0 }}>
                <span className="row g8">
                  {m.pinned && <IconPin />}
                  <b style={{ fontWeight: 500 }} className="trunc">
                    {m.title}
                  </b>
                </span>
                <span className="small muted clamp2">{m.description || m.body.slice(0, 160) || 'Empty'}</span>
              </span>
              {m.type && <span className="label alt">{TYPE_INFO[m.type].label}</span>}
              <span className="mono-s muted" style={{ whiteSpace: 'nowrap', paddingTop: 3 }}>
                {new Date(m.updated).toLocaleDateString()}
              </span>
            </button>
            <IconButton small label={`Delete ${m.title}`} className="mem-del" onClick={() => onDelete(m)}>
              <IconTrash />
            </IconButton>
          </div>
        ))}
        {!items.length && (
          <div className="lr small muted between">
            <span>{total ? 'Nothing matches.' : 'Nothing yet. The AI adds memories as it learns, or add one.'}</span>
            {!total && (
              <Button size="sm" onClick={onNew}>
                Add
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

/** The exact block added to the AI's system prompt, for when you wonder what it knows. */
function PromptPreview({ ws }: { ws: string }) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['memory', 'prompt', ws],
    queryFn: () => api.memoryPrompt(ws),
    enabled: open,
  })
  return (
    <section className="props" aria-label="What the AI sees">
      <div className="props-h">
        <button type="button" className="mono row g8" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <IconChevDown /> : <IconChevRight />}
          What the AI sees <span className="muted">· added to every prompt in {ws}</span>
        </button>
      </div>
      {open && (
        <pre
          className="mono-s"
          style={{ margin: 0, padding: '12px 14px', whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto' }}
        >
          {data?.text ?? 'Loading…'}
        </pre>
      )}
    </section>
  )
}
