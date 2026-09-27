import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { type EditorState, Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { api, type Person } from './api'
import { usePeople } from './boards/shared'
import { pageTitle, relativeLink, resolveLink } from './docLinks'
import { IconFile } from './icons'
import { fileUrl, ShellContext } from './shell/context'
import { highlight, matchesAll, queryWords } from './textMatch'
import { PersonAvatar } from './ui'

/**
 * Notion-style WYSIWYG markdown editor. Uncontrolled: remount (via key) to load new content.
 *
 * With `ws`, typing `@` mentions a person (`@id`) or links a page, `[[` links a page, and clicking a
 * link to a workspace file opens it (⌘/Ctrl-click: beside). `dir` is the folder this document lives
 * in, so links are written relative to it.
 */
export function MarkdownEditor({
  value,
  onChange,
  ws,
  dir = '',
}: {
  value: string
  onChange: (md: string) => void
  ws?: string
  dir?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const viewRef = useRef<EditorView | null>(null)
  const navigate = useNavigate()
  const shell = useContext(ShellContext)
  const people = usePeople()
  const { data: files } = useQuery({
    queryKey: ['files', ws],
    queryFn: () => api.files(ws ?? ''),
    enabled: !!ws,
    staleTime: 30_000,
  })

  // The ProseMirror plugin is created once; it reads the latest props through this ref.
  const live = useRef({ people, dir, ws, openLink: (_path: string, _beside: boolean) => {} })
  live.current = {
    people,
    dir,
    ws,
    openLink: (path, beside) => {
      if (!ws) return
      const to = fileUrl(ws, path)
      if (beside && shell) shell.openBeside(to)
      else navigate(to)
    },
  }

  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const dismissed = useRef<number | null>(null)
  const onViewUpdate = useRef((_view: EditorView) => {})
  onViewUpdate.current = (view) => {
    const t = ws ? findTrigger(view.state) : null
    if (!t || t.from !== dismissed.current) dismissed.current = null
    setTrigger(t && t.from !== dismissed.current && view.hasFocus() ? t : null)
  }

  useEffect(() => {
    if (!root.current) return
    const crepe = new Crepe({ root: root.current, defaultValue: value })
    crepe.editor.use(linksPlugin(live, onViewUpdate))
    let ready = false
    crepe.on((l) =>
      l.markdownUpdated((_ctx, md, prev) => {
        if (ready && md !== prev) onChangeRef.current(md)
      }),
    )
    const created = crepe.create().then(() => {
      ready = true
      viewRef.current = crepe.editor.ctx.get(editorViewCtx)
    })
    return () => {
      viewRef.current = null
      void created.then(() => crepe.destroy())
    }
  }, [])

  // Mention chips depend on who exists: redraw when people load or change.
  useEffect(() => {
    const view = viewRef.current
    if (view) view.dispatch(view.state.tr.setMeta(linksKey, 'people'))
  }, [people])

  const items = useMemo<PickItem[]>(() => {
    if (!trigger) return []
    const words = queryWords(trigger.query)
    const m = (s: string) => !words.length || matchesAll(s, words)
    const out: PickItem[] = []
    if (trigger.kind === '@')
      for (const p of people.filter((p) => m(`${p.name} ${p.id}`)).slice(0, words.length ? 5 : 4))
        out.push({
          key: `p:${p.id}`,
          group: 'People',
          icon: <PersonAvatar id={p.id} people={people} />,
          text: highlight(p.name, words),
          meta: `@${p.id}`,
          insert: { person: p },
        })
    for (const f of (files?.entries ?? []).filter((f) => m(f.path)).slice(0, words.length ? 8 : 5)) {
      const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : ''
      out.push({
        key: `f:${f.path}`,
        group: words.length ? 'Pages' : 'Recent pages',
        icon: <IconFile size={14} />,
        text: highlight(pageTitle(f.name), words),
        meta: folder,
        insert: { path: f.path, name: f.name },
      })
    }
    return out
  }, [trigger?.kind, trigger?.query, people, files])

  const [sel, setSel] = useState(0)
  useEffect(() => setSel(0), [trigger?.kind, trigger?.query])

  const pick = (item: PickItem) => {
    const view = viewRef.current
    if (!view || !trigger) return
    const { schema } = view.state
    const tr =
      'person' in item.insert
        ? view.state.tr.insertText(`@${item.insert.person.id} `, trigger.from, trigger.to)
        : view.state.tr.replaceWith(trigger.from, trigger.to, [
            schema.text(pageTitle(item.insert.name), [
              schema.marks.link.create({ href: relativeLink(dir, item.insert.path) }),
            ]),
            schema.text(' '),
          ])
    view.dispatch(tr.scrollIntoView())
    view.focus()
  }

  const open = !!trigger && items.length > 0

  return (
    <>
      <div
        ref={root}
        className="md-editor"
        onKeyDownCapture={(e) => {
          if (!open) return
          const stop = () => {
            e.preventDefault()
            e.stopPropagation()
          }
          if (e.key === 'ArrowDown') {
            stop()
            setSel((s) => (s + 1) % items.length)
          } else if (e.key === 'ArrowUp') {
            stop()
            setSel((s) => (s - 1 + items.length) % items.length)
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            stop()
            pick(items[Math.min(sel, items.length - 1)])
          } else if (e.key === 'Escape') {
            stop()
            dismissed.current = trigger.from
            setTrigger(null)
          }
        }}
        onBlur={() => setTrigger(null)}
      />
      {open && viewRef.current && (
        <PickMenu view={viewRef.current} at={trigger.from} items={items} sel={sel} setSel={setSel} onPick={pick} />
      )}
    </>
  )
}

interface Trigger {
  kind: '@' | '[['
  query: string
  /** Document range the picked item replaces (the trigger and the query typed after it). */
  from: number
  to: number
}

interface PickItem {
  key: string
  group: 'People' | 'Pages' | 'Recent pages'
  icon: ReactNode
  text: ReactNode
  meta: string
  insert: { person: Person } | { path: string; name: string }
}

/** `@query` (after a space or at line start) or `[[query` right before the caret, outside code. */
function findTrigger(state: EditorState): Trigger | null {
  const { selection } = state
  if (!selection.empty) return null
  const $from = selection.$from
  if ($from.parent.type.spec.code || $from.marks().some((m) => m.type.spec.code)) return null
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 60), $from.parentOffset, undefined, '￼')
  const link = before.match(/\[\[([^\]\n￼]{0,50})$/)
  if (link) return { kind: '[[', query: link[1], from: $from.pos - link[0].length, to: $from.pos }
  const at = before.match(/(?:^|[\s(])@([\p{L}\p{N}._-]{0,30})$/u)
  if (at) return { kind: '@', query: at[1], from: $from.pos - at[1].length - 1, to: $from.pos }
  return null
}

const linksKey = new PluginKey<DecorationSet>('zync-links')
const MENTION = /(^|[^\p{L}\p{N}_@/.])@([a-z0-9][a-z0-9-]{0,31})(?![\p{L}\p{N}_-])/gu

/** Highlights `@id` of known people as chips. */
function mentionDecorations(doc: PMNode, people: Person[]): DecorationSet {
  const byId = new Map(people.map((p) => [p.id, p]))
  const decos: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (parent?.type.spec.code) return false
    if (!node.isText || !node.text || node.marks.some((m) => m.type.spec.code)) return
    for (const m of node.text.matchAll(MENTION)) {
      const p = byId.get(m[2])
      if (!p) continue
      const start = pos + (m.index ?? 0) + m[1].length
      decos.push(
        Decoration.inline(start, start + m[2].length + 1, {
          class: 'mention',
          title: p.name,
          style: p.color ? `--mention:${p.color}` : '',
        }),
      )
    }
  })
  return DecorationSet.create(doc, decos)
}

function linksPlugin(
  live: { current: { people: Person[]; dir: string; ws?: string; openLink: (path: string, beside: boolean) => void } },
  onViewUpdate: { current: (view: EditorView) => void },
) {
  return $prose(
    () =>
      new Plugin({
        key: linksKey,
        state: {
          init: (_, state) => mentionDecorations(state.doc, live.current.people),
          apply: (tr, set) =>
            tr.docChanged || tr.getMeta(linksKey) ? mentionDecorations(tr.doc, live.current.people) : set,
        },
        props: {
          decorations: (state) => linksKey.getState(state),
          handleClick: (_view, _pos, event) => {
            const a = (event.target as HTMLElement | null)?.closest?.('a[href]')
            const path = a && live.current.ws ? resolveLink(live.current.dir, a.getAttribute('href') ?? '') : null
            if (!path) return false
            event.preventDefault()
            live.current.openLink(path, event.metaKey || event.ctrlKey)
            return true
          },
        },
        view: () => ({ update: (view) => onViewUpdate.current(view) }),
      }),
  )
}

function PickMenu({
  view,
  at,
  items,
  sel,
  setSel,
  onPick,
}: {
  view: EditorView
  at: number
  items: PickItem[]
  sel: number
  setSel: (i: number) => void
  onPick: (item: PickItem) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const place = () => {
      const c = view.coordsAtPos(at)
      const h = ref.current?.offsetHeight ?? 280
      const w = ref.current?.offsetWidth ?? 320
      const top = window.innerHeight - c.bottom < h + 12 && c.top > h + 12 ? c.top - h - 6 : c.bottom + 6
      setPos({ top, left: Math.max(8, Math.min(c.left, window.innerWidth - w - 8)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [view, at, items.length])

  useEffect(() => {
    ref.current?.querySelector('.mi.on')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  let idx = -1
  const groups = [...new Set(items.map((i) => i.group))]
  return createPortal(
    <div
      ref={ref}
      className="menu floating pick-menu"
      role="listbox"
      style={pos ?? { visibility: 'hidden' }}
      // Keep focus (and the caret) in the editor.
      onMouseDown={(e) => e.preventDefault()}
    >
      {groups.map((g) => (
        <div key={g} className="col" style={{ gap: 2 }}>
          <span className="mh">{g}</span>
          {items
            .filter((i) => i.group === g)
            .map((it) => {
              idx++
              const i = idx
              return (
                <button
                  key={it.key}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  className={`mi${i === sel ? ' on' : ''}`}
                  onMouseMove={() => setSel(i)}
                  onClick={() => onPick(it)}
                >
                  {it.icon}
                  <span className="grow trunc" style={{ textAlign: 'left' }}>
                    {it.text}
                  </span>
                  {it.meta && <span className="mono-s muted trunc pick-meta">{it.meta}</span>}
                </button>
              )
            })}
        </div>
      ))}
      <div className="row g12 mono-s muted pick-foot">
        <span>↑↓ move</span>
        <span>↵ insert</span>
        <span>esc close</span>
      </div>
    </div>,
    document.body,
  )
}
