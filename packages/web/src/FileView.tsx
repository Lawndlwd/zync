import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, type Board, basename, type CardPatch, dirname, type FileData } from './api'
import { CardDocument } from './boards/CardDocument'
import { boardUrl, statusOf, usePeople } from './boards/shared'
import { Button, ButtonLink } from './components/Button'
import { useToast } from './components/Dialog'
import { TextArea } from './components/Field'
import { Properties } from './files/Properties'
import { IconBoard, IconCheck, IconFile, IconPlus, IconSpin } from './icons'
import { fileUrl, useShell } from './shell/context'
import { Card } from './ui'
import { ago } from './workspaceData'

const MarkdownEditor = lazy(() => import('./MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })))

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i
const PDF = /\.pdf$/i
const MEDIA = /\.(mp4|webm|mov|mp3|wav|ogg)$/i

export function FileView() {
  const { ws = '', '*': splat = '' } = useParams()
  const path = decodeURIComponent(splat)
  if (!path) return <FilesHome ws={ws} />
  const raw = api.rawUrl(ws, path)
  if (IMAGE.test(path))
    return (
      <Frame ws={ws} path={path}>
        <img src={raw} alt={path} className="preview-media" />
      </Frame>
    )
  if (PDF.test(path))
    return (
      <Frame ws={ws} path={path} fill>
        <iframe src={raw} title={path} className="preview-frame" />
      </Frame>
    )
  if (MEDIA.test(path))
    return (
      <Frame ws={ws} path={path}>
        <video src={raw} controls className="preview-media" />
      </Frame>
    )
  return <TextOrCard key={`${ws}:${path}`} ws={ws} path={path} />
}

/** A markdown file inside a board folder is a card: open it as the card page, same as the board panel. */
function TextOrCard({ ws, path }: { ws: string; path: string }) {
  const { data: boards } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  if (!boards) return <PageSkeleton ws={ws} path={path} />
  const board = path.endsWith('.md') ? boards.find((b) => b.path === dirname(path)) : undefined
  return board ? <CardFile ws={ws} path={path} board={board} /> : <TextFile ws={ws} path={path} />
}

function PageSkeleton({ ws, path }: { ws: string; path: string }) {
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className="page file-page">
        <div className="doc col g16">
          <div className="skel" style={{ height: 40, width: '60%' }} />
          <div className="skel" style={{ height: 16 }} />
          <div className="skel" style={{ height: 16, width: '80%' }} />
        </div>
      </div>
    </div>
  )
}

function CardFile({ ws, path, board }: { ws: string; path: string; board: Board }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const people = usePeople()
  const key = ['board', ws, board.path]
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api.board(ws, board.path), refetchInterval: 15_000 })
  const [state, setState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  const file = basename(path)
  const card = data?.cards.find((c) => c.file === file)

  const patch = async (p: CardPatch) => {
    setState('saving')
    try {
      const saved = await api.updateCard(ws, board.path, file, p)
      setState('saved')
      setSaveError('')
      await qc.invalidateQueries({ queryKey: key })
      // A new title renames the file.
      if (saved.file !== file) navigate(fileUrl(ws, `${board.path}/${saved.file}`), { replace: true })
    } catch (e) {
      setState('error')
      setSaveError((e as Error).message)
      toast((e as Error).message, 'bad')
    }
  }

  if (error) return <TextFile ws={ws} path={path} />
  if (!data) return <PageSkeleton ws={ws} path={path} />
  if (!card) return <TextFile ws={ws} path={path} />
  const column = board.columns.find((c) => c.id === statusOf(board, card))

  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} status={<SaveStatus state={state} error={saveError} />} />
      <div className="page file-page">
        <div className="doc col g20">
          <div className="card-banner row g12">
            <IconBoard size={16} />
            <span className="grow small">
              This page is a card on board <b style={{ fontWeight: 600 }}>{board.name}</b> · column {column?.name}
              {card.assignee && (
                <>
                  {' '}
                  · assigned to <b style={{ fontWeight: 600 }}>@{card.assignee}</b>
                </>
              )}
            </span>
            <ButtonLink variant="primary" size="sm" to={`${boardUrl(ws, board.path)}?card=${encodeURIComponent(file)}`}>
              [↗] Open board
            </ButtonLink>
          </div>
          <CardDocument
            ws={ws}
            board={board}
            cards={data.cards}
            people={people}
            card={card}
            onPatch={patch}
            onRun={async () => {
              try {
                await api.runCard(ws, board.path, file)
                toast(`${card.title} · queued`)
              } catch (e) {
                toast((e as Error).message, 'bad')
              }
              await qc.invalidateQueries({ queryKey: key })
            }}
            layout="page"
          />
        </div>
      </div>
    </div>
  )
}

function PathBar({ ws, path, status }: { ws: string; path: string; status?: ReactNode }) {
  const parts = path.split('/')
  return (
    <div className="pathbar">
      <nav className="mono muted row g8 trunc" aria-label="Path">
        <span>{ws}</span>
        {parts.map((p, i) => (
          <span key={parts.slice(0, i + 1).join('/')} className="row g8">
            <span>/</span>
            <span style={i === parts.length - 1 ? { color: 'var(--ink)' } : undefined}>{p}</span>
          </span>
        ))}
      </nav>
      <div className="row g12">
        {status}
        {status && <span style={{ width: 1, height: 18, borderLeft: '1px dashed var(--line)' }} />}
        <a href={api.rawUrl(ws, path)} target="_blank" rel="noreferrer" className="link">
          [Raw ↗]
        </a>
        <a href={api.rawUrl(ws, path)} download={basename(path)} className="link">
          [Download]
        </a>
      </div>
    </div>
  )
}

function Frame({ ws, path, fill, children }: { ws: string; path: string; fill?: boolean; children: ReactNode }) {
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className={`page file-page${fill ? ' fill' : ''}`}>{children}</div>
    </div>
  )
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function SaveStatus({ state, error }: { state: SaveState; error: string }) {
  if (state === 'error')
    return (
      <span className="mono-s danger-t" role="status" title={error}>
        Save failed
      </span>
    )
  return (
    <span className="mono-s row g6" role="status">
      {state === 'saved' ? <IconCheck size={12} sw={2} /> : <IconSpin size={12} />}
      {state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Unsaved'}
    </span>
  )
}

function TextFile({ ws, path }: { ws: string; path: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ['file', ws, path], queryFn: () => api.file(ws, path) })
  const [state, setState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState('')
  // Version the editor was loaded with. Replaced when the file changes on disk (e.g. the AI edited
  // it) and there are no local edits.
  const [loaded, setLoaded] = useState<FileData | null>(null)
  const [external, setExternal] = useState(false)
  const ownMtime = useRef<number | null>(null)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!data) return
    if (!loaded) return setLoaded(data)
    const isOwnWrite = ownMtime.current !== null && data.mtime === ownMtime.current
    if (data.mtime !== loaded.mtime && !isOwnWrite && state === 'saved') {
      setLoaded(data)
      setExternal(true)
      window.setTimeout(() => setExternal(false), 4000)
    }
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
  useEffect(
    () => () => {
      if (pending.current !== null) void flush()
    },
    [],
  )

  if (isLoading)
    return (
      <div className="fileview">
        <PathBar ws={ws} path={path} />
        <div className="page file-page">
          <div className="doc col g16">
            <div className="skel" style={{ height: 40, width: '60%' }} />
            <div className="skel" style={{ height: 16 }} />
            <div className="skel" style={{ height: 16, width: '80%' }} />
          </div>
        </div>
      </div>
    )
  if (error)
    return (
      <div className="fileview">
        <PathBar ws={ws} path={path} />
        <div className="page file-page">
          <p className="lede danger-t">{(error as Error).message}</p>
        </div>
      </div>
    )
  if (!loaded) return null

  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} status={<SaveStatus state={state} error={saveError} />} />
      {external && (
        <div className="toast quiet file-toast" role="status">
          <IconCheck size={13} sw={2} />
          <span>Updated on disk</span>
          <span className="sep">·</span>
          <span className="muted">{ago(new Date(loaded.mtime))}</span>
        </div>
      )}
      <div className="page file-page">
        {loaded.binary ? (
          <div className="doc col g12">
            <p className="lede">
              Binary or large file · <b>{Math.round(loaded.size / 1024)} KB</b>
            </p>
            <a href={api.rawUrl(ws, path)} download className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Download
            </a>
          </div>
        ) : path.toLowerCase().endsWith('.md') ? (
          <MarkdownFile key={loaded.mtime} content={loaded.content ?? ''} onChange={onChange} />
        ) : (
          <div className="doc col g12" style={{ maxWidth: 1100 }}>
            <TextArea
              key={loaded.mtime}
              mono
              className="code-area"
              spellCheck={false}
              aria-label={path}
              defaultValue={loaded.content ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault()
                  void flush()
                }
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const t = e.currentTarget
                  const { selectionStart: a, selectionEnd: b } = t
                  t.setRangeText('  ', a, b, 'end')
                  onChange(t.value)
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/

/**
 * The WYSIWYG editor doesn't understand YAML frontmatter, so it is edited as a property sheet above
 * the body and the two are re-joined on save. Board cards are markdown files whose fields live there.
 */
function MarkdownFile({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  const people = usePeople()
  const match = content.match(FRONTMATTER)
  const front = useRef(match ? match[1] : null)
  const body = useRef(match ? content.slice(match[0].length) : content)
  const emit = () =>
    onChange(
      front.current?.trim() ? `---\n${front.current.trim()}\n---\n\n${body.current.replace(/^\n+/, '')}` : body.current,
    )

  return (
    <div className="doc col g20">
      {front.current !== null && (
        <Properties
          source={front.current}
          people={people}
          onChange={(yaml) => {
            front.current = yaml
            emit()
          }}
        />
      )}
      <Suspense fallback={<div className="skel" style={{ height: 200 }} />}>
        <MarkdownEditor
          value={body.current}
          onChange={(md) => {
            body.current = md
            emit()
          }}
        />
      </Suspense>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Type <span className="kbd">/</span> for blocks · changes save automatically
      </p>
    </div>
  )
}

/** /files with nothing selected: recent files and a way to start. */
function FilesHome({ ws }: { ws: string }) {
  const shell = useShell()
  const { data } = useQuery({ queryKey: ['recent', ws], queryFn: () => api.recent(ws, 100) })
  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / files</span>
        <div className="row between wrap g16" style={{ alignItems: 'flex-end' }}>
          <div className="col g12">
            <h1 className="display">Files</h1>
            <p className="lede">
              Everything in this workspace is a plain file — <b>{data?.total ?? 0} files</b>. Pick one in the tree or
              start a page.
            </p>
          </div>
          <span className="row g8">
            <Button variant="soft" onClick={() => shell.startCreate({ dir: '', kind: 'folder' })}>
              [+] Folder
            </Button>
            <Button variant="primary" onClick={() => shell.startCreate({ dir: '', kind: 'page' })}>
              <IconPlus size={12} sw={1.8} />
              New page
            </Button>
          </span>
        </div>
      </div>
      <Card title="Recently edited" meta={`${Math.min(20, data?.entries.length ?? 0)} of ${data?.total ?? 0}`}>
        <div className="col">
          {!data?.entries.length && <span className="lr small muted">No files yet.</span>}
          {data?.entries.slice(0, 20).map((f) => {
            const i = f.path.lastIndexOf('/')
            return (
              <Link key={f.path} to={fileUrl(ws, f.path)} className="lr row-link">
                <IconFile size={15} sw={1.3} />
                <span className="grow trunc">
                  {i > 0 && <span className="muted">{f.path.slice(0, i + 1)}</span>}
                  {f.name}
                </span>
                <span className="mono-s muted" style={{ width: 96 }}>
                  {ago(new Date(f.mtime))}
                </span>
                <span className="link">[Open ↗]</span>
              </Link>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
