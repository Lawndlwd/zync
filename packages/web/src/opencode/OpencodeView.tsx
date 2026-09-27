import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, type LibraryItem, type LibraryKind } from '../api'
import { Button, TextButton } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { TextArea, TextInput } from '../components/Field'
import { MarkdownFile } from '../FileView'
import { IconCheck, IconFile, IconFolder, IconPlus, IconSpark, IconSpin } from '../icons'
import { OpencodeConfig } from '../SettingsView'
import { wsUrl } from '../shell/context'
import { StatusBadge } from '../ui'

// The AI's setup in one place: opencode.json plus the agents, commands and skills that live next to
// it in opencode's config folder. Every entry is a markdown file (frontmatter + body), edited with
// the same page editor as Files.

const KINDS: { kind: LibraryKind; title: string; one: string; help: string; docs: string }[] = [
  {
    kind: 'agent',
    title: 'Agents',
    one: 'agent',
    help: 'Specialised assistants. Frontmatter: description, mode (primary · subagent · all), model, tools, permission. The page is the system prompt.',
    docs: 'https://opencode.ai/docs/agents/',
  },
  {
    kind: 'command',
    title: 'Commands',
    one: 'command',
    help: 'Reusable prompts you run as /name in the chat. Frontmatter: description, agent, model. $ARGUMENTS is replaced by what you type after the command.',
    docs: 'https://opencode.ai/docs/commands/',
  },
  {
    kind: 'skill',
    title: 'Skills',
    one: 'skill',
    help: 'Know-how the AI loads when a task matches its description. A skill is a folder: SKILL.md (name, description) plus any files it refers to.',
    docs: 'https://opencode.ai/docs/skills/',
  },
]

const libraryUrl = (ws: string, path = '') =>
  wsUrl(ws, `opencode${path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''}`)

export function OpencodeView() {
  const { ws = '', '*': splat = '' } = useParams()
  const path = decodeURIComponent(splat)
  if (!path) return <Library ws={ws} />
  if (path === 'opencode.json')
    return (
      <div className="page col g24">
        <Crumbs ws={ws} parts={['opencode.json']} />
        <RestartBanner />
        <OpencodeConfig />
      </div>
    )
  return <LibraryFile key={path} ws={ws} path={path} />
}

// ── restart: the AI server reads its setup when it starts ───────────────────

const PENDING = ['opencode-pending-restart']

/** Mark that the running AI server doesn't have the latest setup yet. */
function usePendingRestart(): [boolean, () => void] {
  const qc = useQueryClient()
  const { data = false } = useQuery({ queryKey: PENDING, queryFn: () => false, staleTime: Infinity })
  return [data, () => qc.setQueryData(PENDING, true)]
}

function useRestart() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const restart = async () => {
    setBusy(true)
    try {
      const h = await api.restartOpencode()
      qc.setQueryData(['opencode-health'], h)
      qc.setQueryData(PENDING, false)
      toast(`AI server restarted${h.version ? ` · v${h.version}` : ''}`)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setBusy(false)
    }
  }
  return { busy, restart }
}

function RestartBanner() {
  const [pending] = usePendingRestart()
  const { busy, restart } = useRestart()
  if (!pending) return null
  return (
    <div className="card soft row between wrap g12 oc-banner" role="status">
      <span className="small">Saved. The AI server picks up agents, commands and skills when it starts.</span>
      <Button size="sm" variant="primary" busy={busy} onClick={() => void restart()}>
        {busy ? 'Restarting…' : '[↻] Restart AI server'}
      </Button>
    </div>
  )
}

function Health() {
  const health = useQuery({ queryKey: ['opencode-health'], queryFn: api.opencodeHealth, refetchInterval: 10_000 })
  const { busy, restart } = useRestart()
  const h = health.data
  return (
    <span className="row g8">
      {h?.healthy ? (
        <StatusBadge state="ok">Running{h.version ? ` · v${h.version}` : ''}</StatusBadge>
      ) : health.isLoading ? (
        <StatusBadge state="scheduled">Checking</StatusBadge>
      ) : (
        <StatusBadge state="failed">Unreachable</StatusBadge>
      )}
      <Button size="sm" variant="soft" busy={busy} onClick={() => void restart()}>
        {busy ? 'Restarting…' : '[↻] Restart'}
      </Button>
    </span>
  )
}

function Crumbs({ ws, parts, status }: { ws: string; parts: string[]; status?: ReactNode }) {
  return (
    <div className="row between g12 wrap">
      <nav className="mono muted row g8 trunc" aria-label="Breadcrumb">
        <Link to={libraryUrl(ws)} className="link muted">
          OpenCode
        </Link>
        {parts.map((p, i) => (
          <span key={parts.slice(0, i + 1).join('/')} className="row g8">
            <span>/</span>
            <span style={i === parts.length - 1 ? { color: 'var(--ink)' } : undefined}>{p}</span>
          </span>
        ))}
      </nav>
      {status}
    </div>
  )
}

// ── the folder: config, agents, commands, skills ────────────────────────────

/** Agents and commands written inside opencode.json itself (not files), listed for completeness. */
function useInlineEntries() {
  const { data } = useQuery({ queryKey: ['opencode-config'], queryFn: api.opencodeConfig, staleTime: 30_000 })
  try {
    const cfg = JSON.parse(data?.content ?? '{}') as Record<string, Record<string, { description?: string }>>
    return {
      agent: Object.entries(cfg.agent ?? {}).map(([name, v]) => ({ name, description: v?.description })),
      command: Object.entries(cfg.command ?? {}).map(([name, v]) => ({ name, description: v?.description })),
      skill: [] as { name: string; description?: string }[],
    }
  } catch {
    return { agent: [], command: [], skill: [] }
  }
}

function Library({ ws }: { ws: string }) {
  const { data, error } = useQuery({ queryKey: ['opencode-library'], queryFn: api.opencodeLibrary })
  const inline = useInlineEntries()

  return (
    <div className="page col g24">
      <div className="col g16">
        <div className="row between wrap g12">
          <span className="mono muted">{ws} / opencode</span>
          <Health />
        </div>
        <h1 className="display">OpenCode</h1>
        <p className="lede">
          The AI’s setup in one folder: its <b>config</b>, <b>agents</b>, <b>commands</b> and <b>skills</b>. Every chat
          and job runs with it.
        </p>
        {data && <span className="mono-s muted">{data.dir}/</span>}
      </div>
      <RestartBanner />
      {error && <p className="help err">{(error as Error).message}</p>}

      <section className="card" aria-label="Config">
        <div className="card-h">
          <span className="t">Config</span>
          <span className="m">models · providers · MCP servers · permissions</span>
        </div>
        <Link to={libraryUrl(ws, 'opencode.json')} className="oc-row">
          <IconFile size={14} />
          <span className="grow col" style={{ minWidth: 0 }}>
            <span className="oc-name">opencode.json</span>
            <span className="small muted trunc">
              The AI server’s settings. zync keeps its own MCP server and job agent in it.
            </span>
          </span>
          <span className="mono-s muted">Edit →</span>
        </Link>
      </section>

      {KINDS.map((k) => (
        <KindSection
          key={k.kind}
          ws={ws}
          spec={k}
          items={(data?.items ?? []).filter((i) => i.kind === k.kind)}
          inline={inline[k.kind]}
          loading={!data && !error}
        />
      ))}
    </div>
  )
}

function KindSection({
  ws,
  spec,
  items,
  inline,
  loading,
}: {
  ws: string
  spec: (typeof KINDS)[number]
  items: LibraryItem[]
  inline: { name: string; description?: string }[]
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
      navigate(libraryUrl(ws, path))
    } catch (e) {
      setErr((e as Error).message)
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
                setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
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

// ── one file: the page editor ───────────────────────────────────────────────

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function LibraryFile({ ws, path }: { ws: string; path: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [, markPending] = usePendingRestart()
  const library = useQuery({ queryKey: ['opencode-library'], queryFn: api.opencodeLibrary })
  const { data, error, refetch } = useQuery({
    queryKey: ['opencode-file', path],
    queryFn: () => api.libraryFile(path),
    // Always load the file fresh when the page opens (it's saved with the version it was loaded at).
    gcTime: 0,
    staleTime: Infinity,
  })
  const [loaded, setLoaded] = useState<{ content: string; mtime: number } | null>(null)
  const [state, setState] = useState<SaveState>('saved')
  const base = useRef(0)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (data && !loaded) {
      setLoaded(data)
      base.current = data.mtime
    }
  }, [data])

  const flush = async () => {
    clearTimeout(timer.current)
    const content = pending.current
    if (content === null) return
    pending.current = null
    setState('saving')
    try {
      base.current = (await api.saveLibraryFile(path, content, base.current)).mtime
      setState(pending.current === null ? 'saved' : 'dirty')
      markPending()
      void qc.invalidateQueries({ queryKey: ['opencode-library'] })
    } catch (e) {
      pending.current ??= content
      setState('error')
      const msg = (e as Error).message
      if (/changed on disk/i.test(msg)) {
        const ok = await confirm({
          title: 'Changed on disk',
          body: 'This file changed since you opened it. Load that version? Your edits here are discarded.',
          confirmLabel: 'Load latest',
          destructive: true,
        })
        if (ok) {
          pending.current = null
          const r = await refetch()
          if (r.data) {
            setLoaded(r.data)
            base.current = r.data.mtime
            setState('saved')
          }
        }
      } else toast(msg, 'bad')
    }
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => void flushRef.current(), [])
  const onChange = (content: string) => {
    pending.current = content
    setState('dirty')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 700)
  }

  const segs = path.split('/')
  const isSkill = segs[0] === 'skills' || segs[0] === 'skill'
  const item = library.data?.items.find((i) =>
    isSkill ? i.kind === 'skill' && i.path.split('/')[1] === segs[1] : i.path === path,
  )
  const spec = KINDS.find((k) => k.kind === item?.kind)
  const skillRoot = isSkill ? `${segs[0]}/${segs[1]}` : ''

  const remove = async () => {
    const what = isSkill ? `the skill “${segs[1]}” and all its files` : `“${path}”`
    const ok = await confirm({
      title: isSkill && segs[2] === 'SKILL.md' ? 'Delete skill?' : 'Delete file?',
      body: <>This deletes {what}. The AI no longer sees it after the next restart.</>,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      pending.current = null
      const target = isSkill && segs[2] === 'SKILL.md' ? skillRoot : path
      await api.deleteLibraryEntry(target)
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      markPending()
      navigate(isSkill && target !== skillRoot ? libraryUrl(ws, `${skillRoot}/SKILL.md`) : libraryUrl(ws))
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset to zync’s version?',
      body: <>Your changes to the skill “{segs[1]}” are replaced by the version that ships with zync.</>,
      confirmLabel: 'Reset skill',
      destructive: true,
    })
    if (!ok) return
    try {
      pending.current = null
      await api.resetSkill(segs[1])
      await qc.invalidateQueries({ queryKey: ['opencode-library'] })
      const r = await refetch()
      if (r.data) {
        setLoaded(r.data)
        base.current = r.data.mtime
      }
      setState('saved')
      markPending()
      toast('Skill reset')
    } catch (e) {
      toast((e as Error).message, 'bad')
    }
  }

  return (
    <div className="page col g20">
      <Crumbs ws={ws} parts={segs} status={<Save state={state} />} />
      <RestartBanner />
      <div className="row between wrap g12">
        <div className="col g6" style={{ minWidth: 0 }}>
          <h1 className="display oc-title">
            {item?.kind === 'command' ? '/' : ''}
            {isSkill ? segs[1] : (segs[segs.length - 1] ?? '').replace(/\.md$/, '')}
          </h1>
          {spec && <span className="small muted">{spec.help}</span>}
        </div>
        <div className="row g8">
          {isSkill && item?.builtin && item.modified && (
            <Button size="sm" onClick={() => void reset()}>
              Reset to zync’s version
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => void remove()}>
            {isSkill && segs[2] === 'SKILL.md' ? 'Delete skill' : 'Delete'}
          </Button>
        </div>
      </div>

      <div className={isSkill ? 'oc-skill' : ''}>
        {isSkill && (
          <SkillFiles ws={ws} root={skillRoot} current={path} files={item?.files ?? []} onAdded={markPending} />
        )}
        <div className="grow" style={{ minWidth: 0 }}>
          {error ? (
            <p className="lede danger-t">{(error as Error).message}</p>
          ) : !loaded ? (
            <div className="skel" style={{ height: 240 }} />
          ) : path.endsWith('.md') ? (
            <MarkdownFile key={loaded.mtime} ws="" dir="" content={loaded.content} onChange={onChange} />
          ) : (
            <TextArea
              key={loaded.mtime}
              mono
              className="code-area"
              spellCheck={false}
              aria-label={path}
              defaultValue={loaded.content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault()
                  void flush()
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Save({ state }: { state: SaveState }) {
  if (state === 'error') return <span className="mono-s danger-t">Save failed</span>
  return (
    <span className="mono-s row g6" role="status">
      {state === 'saved' ? <IconCheck size={12} sw={2} /> : <IconSpin size={12} />}
      {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}
    </span>
  )
}

/** A skill's folder: SKILL.md first, then the files it refers to; add more inline. */
function SkillFiles({
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
      navigate(libraryUrl(ws, `${root}/${n}`))
    } catch (e) {
      setErr((e as Error).message)
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
