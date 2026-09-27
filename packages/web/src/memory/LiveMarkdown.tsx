import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const MarkdownEditor = lazy(() => import('../MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })))

/**
 * The markdown editor bound to a file on the server: edits save after a pause (and when leaving),
 * and the editor reloads only when the file really changed underneath (the AI saved to it) — never
 * from our own save echoing back, while a save is in flight, or while you're typing. Same rules as
 * a card's body (CardDocument).
 */
export function LiveMarkdown({
  docKey,
  value,
  onSave,
  ws,
}: {
  /** Identity of the document: switching it flushes the pending edit and resets the editor. */
  docKey: string
  /** The server's current text. */
  value: string
  onSave: (md: string) => Promise<unknown>
  ws?: string
}) {
  const pending = useRef<string | null>(null)
  const saving = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const flush = async () => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const md = pending.current
    pending.current = null
    saving.current++
    try {
      await saveRef.current(md)
    } finally {
      saving.current--
    }
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => void flushRef.current(), [docKey])

  const [bodyKey, setBodyKey] = useState(0)
  const last = useRef(value.trim())
  const box = useRef<HTMLDivElement>(null)
  const stale = useRef(false)
  const reload = () => {
    if (pending.current !== null || saving.current > 0) return
    if (value.trim() === last.current) {
      stale.current = false
      return
    }
    if (box.current?.contains(document.activeElement)) {
      stale.current = true
      return
    }
    stale.current = false
    last.current = value.trim()
    setBodyKey((k) => k + 1)
  }
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  useEffect(() => reloadRef.current(), [value])

  return (
    <div
      ref={box}
      onBlur={(e) => {
        if (stale.current && !e.currentTarget.contains(e.relatedTarget as Node)) reloadRef.current()
      }}
    >
      <Suspense fallback={<div className="skel" style={{ height: 160 }} />}>
        <MarkdownEditor
          key={`${docKey}:${bodyKey}`}
          ws={ws}
          value={value}
          onChange={(md) => {
            pending.current = md
            last.current = md.trim()
            clearTimeout(timer.current)
            timer.current = window.setTimeout(() => void flushRef.current(), 700)
          }}
        />
      </Suspense>
    </div>
  )
}
