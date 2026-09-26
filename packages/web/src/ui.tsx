import { type CSSProperties, type ReactNode, type RefObject, useEffect } from 'react'
import { Link } from 'react-router'
import type { Person } from './api'
import { IconCheck, IconClock, IconCross, IconSkip, IconSpark, IconSpin, IconTimeout } from './icons'

// Small zync primitives shared by the shell and the views. Markup mirrors zync-design exactly.

export function Card({
  title,
  meta,
  className = '',
  style,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <section className={`card ${className}`} style={style}>
      <div className="card-h">
        <span className="t">{title}</span>
        {typeof meta === 'string' ? <span className="m">{meta}</span> : meta}
      </div>
      {children}
    </section>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}

/** Number + label chip; `bad` switches to the danger pair. */
export function Chip({ n, label, bad, to }: { n: number; label: string; bad?: boolean; to?: string }) {
  const inner = (
    <>
      <b>{n}</b>
      <span>{label}</span>
    </>
  )
  const cls = `chip${bad ? ' bad' : ''}`
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

export type RunState = 'ok' | 'failed' | 'timeout' | 'skipped' | 'running' | 'scheduled'

const ST: Record<RunState, { cls: string; word: string; icon: ReactNode }> = {
  ok: { cls: 'st-ok', word: 'OK', icon: <IconCheck /> },
  failed: { cls: 'st-fail', word: 'Failed', icon: <IconCross /> },
  timeout: { cls: 'st-time', word: 'Timed out', icon: <IconTimeout /> },
  skipped: { cls: 'st-skip', word: 'Skipped', icon: <IconSkip /> },
  running: { cls: 'st-run', word: 'Running', icon: <IconSpin size={11} sw={2.2} /> },
  scheduled: { cls: 'st-sched', word: 'Scheduled', icon: <IconClock size={11} sw={1.8} /> },
}

/** Run / AI state badge — always glyph + word, never colour alone. */
export function StatusBadge({ state, children }: { state: RunState; children?: ReactNode }) {
  const s = ST[state]
  return (
    <span className={`st ${s.cls}`}>
      {s.icon}
      {children ?? s.word}
    </span>
  )
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

/** Readable text on a person's colour: dark ink on light swatches, light on dark ones. */
function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b1b16' : '#F4F7EC'
}

export function PersonAvatar({
  id,
  people,
  size,
  className = '',
}: {
  id?: string
  people: Person[]
  size?: 'l' | 'xl'
  className?: string
}) {
  if (!id) return null
  const p = people.find((x) => x.id === id)
  const name = p?.name ?? id
  const sz = size ? ` av-${size}` : ''
  if (id === 'ai')
    return (
      <span className={`av av-ai${sz} ${className}`} title="@ai">
        <IconSpark size={size ? 13 : 11} />
      </span>
    )
  if (id === 'me')
    return (
      <span className={`av av-me${sz} ${className}`} title={`@me · ${name}`}>
        {initials(name)}
      </span>
    )
  const style = p?.color
    ? { background: p.color, color: textOn(p.color) }
    : { background: 'var(--sage-1)', color: 'var(--ink)' }
  return (
    <span className={`av${sz} ${className}`} style={style} title={`@${id} · ${name}`}>
      {initials(name)}
    </span>
  )
}

/** Close a popover on outside click or Escape. Clicks inside `also` (e.g. its trigger) don't count. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  also?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || also?.current?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [ref, open, close, also])
}
