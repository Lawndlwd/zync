import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { api, type FileData } from './api'

const MarkdownEditor = lazy(() => import('./MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })))

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i
const PDF = /\.pdf$/i
const MEDIA = /\.(mp4|webm|mov|mp3|wav|ogg)$/i

export function FileView() {
  const { ws = '', '*': splat = '' } = useParams()
  const path = decodeURIComponent(splat)
  if (!path) {
    return (
      <div className="center muted">
        <p>Select a page on the left, or create one with “+ Page”.</p>
        <p>Open “Chat” to work with the AI on this workspace.</p>
      </div>
    )
  }
  if (IMAGE.test(path))
    return (
      <Frame path={path}>
        <img src={api.rawUrl(ws, path)} alt={path} className="preview" />
      </Frame>
    )
  if (PDF.test(path))
    return (
      <Frame path={path}>
        <iframe src={api.rawUrl(ws, path)} title={path} className="preview-frame" />
      </Frame>
    )
  if (MEDIA.test(path))
    return (
      <Frame path={path}>
        <video src={api.rawUrl(ws, path)} controls className="preview" />
      </Frame>
    )
  return <TextFile key={`${ws}:${path}`} ws={ws} path={path} />
}

function Frame({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="file">
      <div className="file-header">
        <span className="file-path">{path}</span>
      </div>
      <div className="file-body">{children}</div>
    </div>
  )
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function TextFile({ ws, path }: { ws: string; path: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ['file', ws, path], queryFn: () => api.file(ws, path) })
  const [state, setState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  // Version of the content the editor was loaded with. Bump it to reload the editor
  // when the file changes on disk (e.g. the AI edited it) and there are no local edits.
  const [loaded, setLoaded] = useState<FileData | null>(null)
  const ownMtime = useRef<number | null>(null)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!data) return
    if (!loaded) return setLoaded(data)
    const isOwnWrite = ownMtime.current !== null && data.mtime === ownMtime.current
    if (data.mtime !== loaded.mtime && !isOwnWrite && state === 'saved') setLoaded(data)
  }, [data])

  const flush = async () => {
    clearTimeout(timer.current)
    const content = pending.current
    if (content === null) return
    pending.current = null
    setState('saving')
    try {
      const res = await api.save(ws, path, content)
      ownMtime.current = res.mtime
      setState(pending.current === null ? 'saved' : 'dirty')
      setSaveError('')
    } catch (e) {
      pending.current ??= content
      setState('error')
      setSaveError((e as Error).message)
    }
  }

  const onChange = (content: string) => {
    pending.current = content
    setState('dirty')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
  }

  // Save on unmount / file switch.
  useEffect(
    () => () => {
      if (pending.current !== null) void flush()
    },
    [],
  )

  if (isLoading) return <div className="center muted">Loading…</div>
  if (error) return <div className="center error">{(error as Error).message}</div>
  if (!loaded) return null

  const label = { saved: 'Saved', dirty: 'Unsaved…', saving: 'Saving…', error: `Save failed: ${saveError}` }[state]

  return (
    <div className="file">
      <div className="file-header">
        <span className="file-path">{path}</span>
        <span className={`save-state ${state}`}>{label}</span>
        <a href={api.rawUrl(ws, path)} target="_blank" rel="noreferrer">
          raw
        </a>
      </div>
      <div className="file-body">
        {loaded.binary ? (
          <p className="muted">
            Binary or large file ({Math.round(loaded.size / 1024)} KB).{' '}
            <a href={api.rawUrl(ws, path)} download>
              Download
            </a>
          </p>
        ) : path.toLowerCase().endsWith('.md') ? (
          <Suspense fallback={<div className="center muted">Loading editor…</div>}>
            <MarkdownEditor key={loaded.mtime} value={loaded.content ?? ''} onChange={onChange} />
          </Suspense>
        ) : (
          <textarea
            key={loaded.mtime}
            className="code"
            spellCheck={false}
            defaultValue={loaded.content ?? ''}
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
  )
}
