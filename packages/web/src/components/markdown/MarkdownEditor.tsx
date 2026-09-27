import { Crepe } from '@milkdown/crepe'

// oxlint-disable-next-line import/no-unassigned-import -- CSS import
import '@milkdown/crepe/theme/common/style.css'
// oxlint-disable-next-line import/no-unassigned-import -- CSS import
import '@milkdown/crepe/theme/frame.css'
import { editorViewCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { useQuery } from '@tanstack/react-query'
import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../../api'
import { pageTitle, relativeLink } from '../../helpers/docLinks'
import { dirname } from '../../helpers/paths'
import { highlight, matchesAll, queryWords } from '../../helpers/textMatch'
import { fileUrl } from '../../helpers/urls'
import { usePeople } from '../../hooks/usePeople'
import { IconFile } from '../../icons'
import { ShellContext } from '../../shell/ShellContext'
import { PersonAvatar } from '../PersonAvatar'
import { findTrigger, linksKey, linksPlugin } from './helpers'
import { PickMenu } from './PickMenu'
import type { Live, PickItem, Trigger } from './types'

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
  const [view, setView] = useState<EditorView | null>(null)
  const navigate = useNavigate()
  const shell = useContext(ShellContext)
  const people = usePeople()
  const { data: files } = useQuery({
    queryKey: ['files', ws],
    queryFn: () => api.files(ws ?? ''),
    enabled: !!ws,
    staleTime: 30_000,
  })

  // The ProseMirror plugin is created once; it reads the latest props through these.
  const live = useEffectEvent((): Live => ({
    people,
    dir,
    ws,
    openLink: (path, beside) => {
      if (!ws) return
      const to = fileUrl(ws, path)
      if (beside && shell) shell.openBeside(to)
      else void navigate(to)
    },
  }))
  const initial = useEffectEvent(() => value)
  const change = useEffectEvent((md: string) => onChange(md))

  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const dismissed = useRef<number | null>(null)
  const onViewUpdate = useEffectEvent((v: EditorView) => {
    const t = ws ? findTrigger(v.state) : null
    if (!t || t.from !== dismissed.current) dismissed.current = null
    setTrigger(t && t.from !== dismissed.current && v.hasFocus() ? t : null)
  })

  useEffect(() => {
    const host = root.current
    if (!host) return
    // A container per instance: under StrictMode the second editor mounts while the first is
    // still being torn down, and they must not share the DOM.
    const el = document.createElement('div')
    host.append(el)
    const crepe = new Crepe({ root: el, defaultValue: initial() })
    crepe.editor.use(linksPlugin(live, onViewUpdate))
    let ready = false
    let cancelled = false
    crepe.on((l) =>
      l.markdownUpdated((_ctx, md, prev) => {
        if (ready && !cancelled && md !== prev) change(md)
      }),
    )
    const created = crepe.create().then(() => {
      if (cancelled) return null
      ready = true
      setView(crepe.editor.ctx.get(editorViewCtx))
      return null
    })
    return () => {
      cancelled = true
      setView(null)
      void created.then(() => {
        void crepe.destroy()
        el.remove()
        return null
      })
    }
  }, [])

  // Mention chips depend on who exists: redraw when people load or change.
  useEffect(() => {
    if (view) view.dispatch(view.state.tr.setMeta(linksKey, people))
  }, [people, view])

  const items: PickItem[] = []
  if (trigger) {
    const words = queryWords(trigger.query)
    const m = (s: string) => !words.length || matchesAll(s, words)
    if (trigger.kind === '@')
      for (const p of people.filter((person) => m(`${person.name} ${person.id}`)).slice(0, words.length ? 5 : 4))
        items.push({
          key: `p:${p.id}`,
          group: 'People',
          icon: <PersonAvatar id={p.id} people={people} />,
          text: highlight(p.name, words),
          meta: `@${p.id}`,
          insert: { person: p },
        })
    for (const f of (files?.entries ?? []).filter((file) => m(file.path)).slice(0, words.length ? 8 : 5)) {
      const folder = dirname(f.path)
      items.push({
        key: `f:${f.path}`,
        group: words.length ? 'Pages' : 'Recent pages',
        icon: <IconFile size={14} />,
        text: highlight(pageTitle(f.name), words),
        meta: folder,
        insert: { path: f.path, name: f.name },
      })
    }
  }

  // Back to the first item whenever the query changes.
  const [sel, setSel] = useState(0)
  const triggerKey = trigger ? `${trigger.kind}${trigger.query}` : ''
  const [selFor, setSelFor] = useState(triggerKey)
  if (selFor !== triggerKey) {
    setSelFor(triggerKey)
    setSel(0)
  }

  const pick = (item: PickItem) => {
    if (!view || !trigger) return
    const { schema } = view.state
    const { insert } = item
    let tr
    if ('person' in insert) tr = view.state.tr.insertText(`@${insert.person.id} `, trigger.from, trigger.to)
    else {
      const link = schema.marks.link
      if (!link) return
      tr = view.state.tr.replaceWith(trigger.from, trigger.to, [
        schema.text(pageTitle(insert.name), [link.create({ href: relativeLink(dir, insert.path) })]),
        schema.text(' '),
      ])
    }
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
            const item = items[Math.min(sel, items.length - 1)]
            if (item) pick(item)
          } else if (e.key === 'Escape') {
            stop()
            dismissed.current = trigger.from
            setTrigger(null)
          }
        }}
        onBlur={() => setTrigger(null)}
      />
      {open && view && <PickMenu view={view} at={trigger.from} items={items} sel={sel} setSel={setSel} onPick={pick} />}
    </>
  )
}
