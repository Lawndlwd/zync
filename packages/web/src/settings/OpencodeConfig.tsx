import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense, useRef, useState } from 'react'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { LazyCodeEditor } from '../components/LazyCodeEditor'
import { SaveStatus } from '../components/SaveStatus'
import { StatusBadge } from '../components/StatusBadge'
import { errorMessage } from '../helpers/format'
import type { SaveState } from '../types/save'
import { jsonError } from './helpers'

/** opencode.json as a code editor: models, providers, MCP servers, plugins, agents, permissions. */
export function OpencodeConfig() {
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
  const [state, setState] = useState<Exclude<SaveState, 'error'>>('saved')
  const [restarting, setRestarting] = useState(false)
  // Latest editor text for saves in flight (null until edited or reloaded: then it's `text`).
  const textRef = useRef<string | null>(null)

  const show = (d: { content: string; mtime: number }) => {
    setText(d.content)
    setBase(d.mtime)
    setState('saved')
    setVersion((v) => v + 1)
  }
  // Loaded once; later only on an explicit reload, so a refetch never wipes unsaved edits.
  if (data && text === null) show(data)
  const reload = async () => {
    const r = await refetch()
    if (r.data) {
      textRef.current = r.data.content
      show(r.data)
    }
  }

  const invalid = text === null ? null : jsonError(text)

  const save = async () => {
    const content = textRef.current ?? text ?? ''
    const err = jsonError(content)
    if (err) {
      toast(`Not saved — ${err}`, 'bad')
      return false
    }
    setState('saving')
    try {
      const res = await api.saveOpencodeConfig(content, base)
      setBase(res.mtime)
      setState((textRef.current ?? content) === content ? 'saved' : 'dirty')
      toast('opencode.json saved — restart the AI server to apply')
      return true
    } catch (caught) {
      setState('dirty')
      const msg = errorMessage(caught)
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
    } catch (err) {
      toast(errorMessage(err), 'bad')
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
          <SaveStatus state={state} style={{ marginRight: 4 }} />
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
      {error && <span className="help err">{error.message}</span>}
      {invalid && state !== 'saved' && <span className="help err mono-s">JSON error · {invalid}</span>}
      <div className="code-wrap">
        {text === null ? (
          <div className="skel" style={{ height: 420 }} />
        ) : (
          <Suspense fallback={<div className="skel" style={{ height: 420 }} />}>
            <LazyCodeEditor
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
        zync adds its own <span className="mono-s">zync-jobs</span> MCP server and <span className="mono-s">job</span>{' '}
        agent every time the AI server starts, so keep those entries. Saving doesn’t change the running server — Restart
        applies it.
      </p>
    </section>
  )
}
