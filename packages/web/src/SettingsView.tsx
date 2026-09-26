import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api } from './api'
import { Button } from './components/Button'
import { Segmented } from './components/Controls'
import { useConfirm, useToast } from './components/Dialog'
import { IconCheck, IconSpin } from './icons'
import { type Theme, useShell } from './shell/context'
import { Card, StatusBadge } from './ui'

const CodeEditor = lazy(() => import('./components/CodeEditor').then((m) => ({ default: m.CodeEditor })))

export function SettingsView() {
  const { ws = '' } = useParams()
  const shell = useShell()
  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / settings</span>
        <h1 className="display">Settings</h1>
        <p className="lede">
          How zync looks, and the <b>AI server</b> config every chat and job runs with.
        </p>
      </div>
      <Card title="Appearance" meta="This browser">
        <div className="row between wrap g12">
          <span className="small muted">Follow the system, or pick one.</span>
          <Segmented<Theme>
            label="Theme"
            value={shell.theme}
            onChange={shell.setTheme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Card>
      <OpencodeConfig />
    </div>
  )
}

type Save = 'saved' | 'dirty' | 'saving'

function validate(text: string): string | null {
  try {
    JSON.parse(text)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

/** opencode.json as a code editor: models, providers, MCP servers, plugins, agents, permissions. */
function OpencodeConfig() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { data, error, refetch } = useQuery({
    queryKey: ['opencode-config'],
    queryFn: api.opencodeConfig,
    staleTime: Infinity,
  })
  const health = useQuery({ queryKey: ['opencode-health'], queryFn: api.opencodeHealth, refetchInterval: 10_000 })
  const [text, setText] = useState<string | null>(null)
  const [base, setBase] = useState(0)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<Save>('saved')
  const [restarting, setRestarting] = useState(false)
  const textRef = useRef('')

  const load = (d: { content: string; mtime: number }) => {
    setText(d.content)
    textRef.current = d.content
    setBase(d.mtime)
    setState('saved')
    setVersion((v) => v + 1)
  }
  const reload = async () => {
    const r = await refetch()
    if (r.data) load(r.data)
  }
  useEffect(() => {
    if (data) load(data)
  }, [data])

  const invalid = text === null ? null : validate(text)

  const save = async () => {
    const content = textRef.current
    const err = validate(content)
    if (err) {
      toast(`Not saved — ${err}`, 'bad')
      return false
    }
    setState('saving')
    try {
      const res = await api.saveOpencodeConfig(content, base)
      setBase(res.mtime)
      setState(textRef.current === content ? 'saved' : 'dirty')
      toast('opencode.json saved — restart the AI server to apply')
      return true
    } catch (e) {
      setState('dirty')
      const msg = (e as Error).message
      if (/changed on disk/i.test(msg)) {
        const ok = await confirm({
          title: 'Config changed on disk',
          body: 'Someone (or opencode at start-up) changed opencode.json since you opened it. Load that version? Your edits here are discarded.',
          confirmLabel: 'Load latest',
          destructive: true,
        })
        if (ok) await reload()
      } else toast(msg, 'bad')
      return false
    }
  }

  const restart = async () => {
    if (state !== 'saved') {
      const ok = await confirm({
        title: 'Save and restart?',
        body: 'You have unsaved changes. Save them first so the AI server restarts with them.',
        confirmLabel: 'Save and restart',
      })
      if (!ok || !(await save())) return
    }
    setRestarting(true)
    try {
      const h = await api.restartOpencode()
      qc.setQueryData(['opencode-health'], h)
      toast(`AI server restarted${h.version ? ` · v${h.version}` : ''}`)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      setRestarting(false)
    }
  }

  const format = () => {
    if (invalid || text === null) return
    const pretty = `${JSON.stringify(JSON.parse(text), null, 2)}\n`
    if (pretty === text) return
    setText(pretty)
    textRef.current = pretty
    setState('dirty')
    setVersion((v) => v + 1)
  }

  const h = health.data
  return (
    <section className="card" style={{ gap: 14 }} aria-label="AI server config">
      <div className="card-h" style={{ marginBottom: 0 }}>
        <span className="t">AI server · opencode.json</span>
        <span className="row g8">
          {h?.healthy ? (
            <StatusBadge state="ok">Running{h.version ? ` · v${h.version}` : ''}</StatusBadge>
          ) : health.isLoading ? (
            <StatusBadge state="scheduled">Checking</StatusBadge>
          ) : (
            <StatusBadge state="failed">Unreachable</StatusBadge>
          )}
        </span>
      </div>
      <div className="row between wrap g12">
        <div className="col g4" style={{ minWidth: 0 }}>
          <span className="small muted">
            Models, providers, MCP servers, plugins, agents and permissions.{' '}
            <a className="link" href="https://opencode.ai/docs/config/" target="_blank" rel="noreferrer">
              [Docs ↗]
            </a>
          </span>
          <span className="mono-s muted trunc" title={data?.path}>
            {data?.path ?? '…'}
            {data && !data.exists && ' · not created yet'}
          </span>
        </div>
        <div className="row g8">
          <span className="mono-s row g6" role="status" style={{ marginRight: 4 }}>
            {state === 'saved' ? <IconCheck size={12} sw={2} /> : <IconSpin size={12} />}
            {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}
          </span>
          <Button size="sm" disabled={!!invalid} onClick={format}>
            Format
          </Button>
          <Button size="sm" disabled={state === 'saved'} onClick={() => void reload()}>
            Revert
          </Button>
          <Button size="sm" variant="primary" disabled={state !== 'dirty' || !!invalid} onClick={() => void save()}>
            Save <span className="kbd kbd-on-accent">⌘S</span>
          </Button>
          <Button size="sm" variant="soft" busy={restarting} onClick={() => void restart()}>
            {restarting ? 'Restarting…' : '[↻] Restart AI server'}
          </Button>
        </div>
      </div>
      {error && <span className="help err">{(error as Error).message}</span>}
      {invalid && state !== 'saved' && <span className="help err mono-s">JSON error · {invalid}</span>}
      <div className="code-wrap">
        {text === null ? (
          <div className="skel" style={{ height: 420 }} />
        ) : (
          <Suspense fallback={<div className="skel" style={{ height: 420 }} />}>
            <CodeEditor
              key={version}
              value={text}
              ariaLabel="opencode.json"
              onSave={() => void save()}
              onChange={(v) => {
                textRef.current = v
                setText(v)
                setState('dirty')
              }}
            />
          </Suspense>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        zync adds its own <span className="mono-s">zync-jobs</span> MCP server, <span className="mono-s">job</span>{' '}
        agent and skills folder every time the AI server starts, so keep those entries. Saving doesn’t change the
        running server — Restart applies it.
      </p>
    </section>
  )
}
