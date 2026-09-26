import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from './api'
import { boardUrl } from './boards/shared'
import {
  IconBoard,
  IconCheck,
  IconChevDown,
  IconClock,
  IconCross,
  IconFile,
  IconSkip,
  IconSpark,
  IconSpin,
  IconWarn,
} from './icons'
import { fileUrl, isTyping, usePref, useShell, wsUrl } from './shell/context'
import { Card, Chip, StatusBadge, useDismiss } from './ui'
import {
  addDays,
  ago,
  type BoardCard,
  dayLabel,
  dueDate,
  dueThisWeek,
  hhmm,
  myCards,
  pad2,
  type RunEvent,
  reviewCards,
  runningCards,
  sameDay,
  stamp,
  startOfDay,
  startOfWeek,
  until,
  upcoming,
  useWorkspaceData,
  type WorkspaceData,
} from './workspaceData'

type Range = 'today' | 'week'

/** Re-render every 30 s so clocks and "in 2h 48m" stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const bad = (r: RunEvent) => r.run.status === 'failed' || r.run.status === 'timeout'

export function Overview() {
  const shell = useShell()
  const { ws } = shell
  const navigate = useNavigate()
  const data = useWorkspaceData(ws)
  const now = useNow()
  const [range, setRange] = usePref<Range>('zync:overviewRange', 'today')
  const me = data.people.find((p) => p.id === 'me')
  const name = me && me.name !== 'Me' ? me.name : ''

  const from = range === 'today' ? startOfDay(now) : startOfWeek(now)
  const inRange = data.runs.filter((r) => r.time >= from)
  const today = data.runs.filter((r) => sameDay(r.time, now))
  const finished = today.filter((r) => r.run.status === 'ok').length
  const needs = today.filter(bad).length
  const review = reviewCards(data.cards)
  const due = dueThisWeek(data.cards, now)
  const failedInRange = inRange.filter(bad).length
  const firstBoard = data.boards[0]

  const quick = {
    newPage: () => shell.startCreate({ dir: '', kind: 'page' }),
    newCard: () => navigate(firstBoard ? boardUrl(ws, firstBoard.path) : wsUrl(ws, 'boards')),
    schedule: () => navigate(wsUrl(ws, 'jobs')),
    ask: () => shell.dock === 'rail' && shell.toggleDock(),
    boards: () => navigate(wsUrl(ws, 'boards')),
  }
  const quickRef = useRef(quick)
  quickRef.current = quick

  // Quick-access single-key shortcuts (N, C, S, B) while nothing is being typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target)) return
      if (document.querySelector('.palette-wrap')) return
      const q = quickRef.current
      const fn = { n: q.newPage, c: q.newCard, s: q.schedule, b: q.boards }[e.key.toLowerCase()]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="page col g24">
      <div className="col g16">
        <div className="row between">
          <span className="mono muted">{ws} / overview</span>
          <span className="mono muted">{stamp(now)}</span>
        </div>
        <h1 className="display">Today’s Overview</h1>
        <p className="lede">
          Hello{name ? `, ${name}` : ''}!{' '}
          {finished || needs ? (
            <>
              The AI finished <b>{plural(finished, 'task')}</b> and{' '}
              <b>
                {needs} {needs === 1 ? 'needs' : 'need'} you
              </b>
              .
            </>
          ) : (
            'Nothing from the AI needs you right now.'
          )}
        </p>
        <div className="row g8 wrap" style={{ marginTop: 4 }}>
          <Chip
            n={review.length}
            label="In review"
            to={review[0] ? boardUrl(ws, review[0].board.path) : wsUrl(ws, 'boards')}
          />
          <Chip
            n={failedInRange}
            label={failedInRange === 1 ? 'Failed run' : 'Failed runs'}
            bad={failedInRange > 0}
            to={wsUrl(ws, 'jobs')}
          />
          <Chip
            n={due.length}
            label="Due this week"
            to={due[0] ? boardUrl(ws, due[0].board.path) : wsUrl(ws, 'boards')}
          />
          <RangeButton range={range} setRange={setRange} />
        </div>
      </div>

      <div className="ov-grid">
        <QuickAccess quick={quick} />
        <ReadyForReview ws={ws} cards={review} />
        <RunResults ws={ws} data={data} runs={inRange} range={range} />
        <Schedule data={data} now={now} />
        <MyCards ws={ws} data={data} now={now} />
        <RunsThisWeek data={data} now={now} />
        <Workload data={data} now={now} />
        <RecentlyEdited ws={ws} data={data} now={now} />
      </div>
    </div>
  )
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function RangeButton({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const label = range === 'today' ? 'Today' : 'This week'
  return (
    <div ref={ref} style={{ marginLeft: 'auto', position: 'relative' }}>
      <button
        className="btn btn-ghost"
        aria-label={`Range: ${label.toLowerCase()}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <IconChevDown />
      </button>
      {open && (
        <div className="menu pop" style={{ top: 40, right: 0, minWidth: 160 }} role="menu">
          {(['today', 'week'] as const).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={range === r}
              className={`mi${range === r ? ' on' : ''}`}
              onClick={() => {
                setRange(r)
                close()
              }}
            >
              {r === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── quick access ───────────────────────────────────────────────────────────

function QuickAccess({ quick }: { quick: Record<'newPage' | 'newCard' | 'schedule' | 'ask' | 'boards', () => void> }) {
  const row: CSSProperties = { color: 'var(--on-accent)', width: '100%', textAlign: 'left' }
  const key: CSSProperties = { marginLeft: 'auto', opacity: 0.6 }
  const items: [string, () => void, string][] = [
    ['[+] New page', quick.newPage, 'N'],
    ['[+] New card', quick.newCard, 'C'],
    ['[+] Schedule AI job', quick.schedule, 'S'],
    ['[↗] Ask AI', quick.ask, '⌘J'],
    ['[↗] All boards', quick.boards, 'B'],
  ]
  return (
    <section className="card hero c-hero" style={{ justifyContent: 'space-between' }}>
      <div>
        <div className="card-h">
          <span className="t">Quick access</span>
          <span className="m">⌘K</span>
        </div>
        <p className="h2" style={{ color: 'var(--on-accent)', maxWidth: 220 }}>
          Start something, or hand it off.
        </p>
      </div>
      <div className="col" style={{ marginTop: 24 }}>
        {items.map(([label, fn, k]) => (
          <button key={label} className="lr mono" style={row} onClick={fn}>
            {label}
            <span style={key}>{k}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── ready for review ───────────────────────────────────────────────────────

function ReadyForReview({ ws, cards }: { ws: string; cards: BoardCard[] }) {
  return (
    <Card title="Ready for review" meta="Finished by AI" className="c-review">
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <span className="small muted" style={{ maxWidth: 220 }}>
          Cards the AI moved to Review. Accept, or send back with a note.
        </span>
        <span className="num">{pad2(cards.length)}</span>
      </div>
      <div className="col">
        {!cards.length && <span className="lr small muted">Nothing waiting on you.</span>}
        {cards.slice(0, 3).map((c) => (
          <div key={c.ref} className="lr">
            <IconSpark />
            <span className="grow trunc">{c.card.title}</span>
            <span className="sep">|</span>
            <span className="mono-s muted">{c.board.name}</span>
            <span className="sep">|</span>
            <Link to={`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`} className="link">
              [View ↗]
            </Link>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── run results ────────────────────────────────────────────────────────────

function RunResults({ ws, data, runs, range }: { ws: string; data: WorkspaceData; runs: RunEvent[]; range: Range }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = runs.filter((r) => r.run.status === 'ok').length
  const failed = runs.filter((r) => r.run.status === 'failed')
  const timedOut = runs.filter((r) => r.run.status === 'timeout').length
  const lastFail = failed[0]
  // Retry what is still broken: jobs whose latest run failed or timed out.
  const retry = data.jobs.filter((j) => j.lastRun?.status === 'failed' || j.lastRun?.status === 'timeout')

  const doRetry = async () => {
    setBusy(true)
    setErr('')
    try {
      for (const j of retry) {
        const card = j.job?.card ? data.cards.find((c) => c.ref === j.job?.card) : undefined
        if (card) await api.runCard(ws, card.board.path, card.card.file)
        else await api.runJob(ws, j.name)
      }
      qc.invalidateQueries({ queryKey: ['jobs', ws] })
      qc.invalidateQueries({ queryKey: ['board', ws] })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const rowStyle: CSSProperties = { padding: '14px 0', alignItems: 'flex-end' }
  return (
    <Card title="Run results" meta={range === 'today' ? 'Today' : 'This week'} className="c-results">
      <div className="col g4">
        <div className="lr" style={rowStyle}>
          <StatusBadge state="ok" />
          <span className="grow" />
          <span className="num-m">{pad2(ok)}</span>
        </div>
        <div
          className={`lr${failed.length ? ' hl' : ''}`}
          style={failed.length ? { padding: '14px 10px', alignItems: 'flex-end' } : rowStyle}
        >
          <span className="col g4">
            <StatusBadge state="failed" />
            {lastFail && (
              <span className="mono-s">
                {lastFail.title} · {hhmm(lastFail.time)}
              </span>
            )}
          </span>
          <span className="grow" />
          <span className="num-m">{pad2(failed.length)}</span>
        </div>
        <div className="lr" style={rowStyle}>
          <StatusBadge state="timeout" />
          <span className="grow" />
          <span className="num-m">{pad2(timedOut)}</span>
        </div>
      </div>
      {err && <span className="help err">{err}</span>}
      <div className="row g8" style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button className="btn btn-primary btn-sm" disabled={!retry.length || busy} onClick={doRetry}>
          {busy ? 'Retrying…' : 'Retry failed'}
        </button>
        <Link to={wsUrl(ws, 'jobs')} className="link" style={{ marginLeft: 'auto' }}>
          [History ↗]
        </Link>
      </div>
    </Card>
  )
}

// ── today's AI schedule ────────────────────────────────────────────────────

interface Slot {
  key: string
  time: Date
  kind: 'job' | 'card'
  title: string
  state: 'ok' | 'failed' | 'timeout' | 'skipped' | 'running' | 'next' | 'planned'
}

function todaySlots(data: WorkspaceData, now: Date): Slot[] {
  const past: Slot[] = data.runs
    .filter((r) => sameDay(r.time, now))
    .map((r) => ({ key: `r:${r.job}:${r.run.ts}`, time: r.time, kind: r.kind, title: r.title, state: r.run.status }))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .slice(-3)
  const running: Slot[] = runningCards(data.cards).map((c) => ({
    key: `run:${c.ref}`,
    time: c.card.runAt ? new Date(c.card.runAt) : now,
    kind: 'card',
    title: c.card.title,
    state: 'running',
  }))
  const later: Slot[] = upcoming(data.jobs, data.cards, now)
    .filter((u) => sameDay(u.time, now))
    .slice(0, 6)
    .map((u, i) => ({
      key: `u:${u.job}:${u.time.getTime()}`,
      time: u.time,
      kind: u.kind,
      title: u.title,
      state: i ? 'planned' : 'next',
    }))
  return [...past, ...running, ...later]
}

function Schedule({ data, now }: { data: WorkspaceData; now: Date }) {
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity })
  const slots = todaySlots(data, now)
  return (
    <Card title="Today’s AI schedule" meta={config?.timezone ?? ''} className="c-sched">
      {!slots.length ? (
        <span className="small muted ov-empty">
          Nothing scheduled today. Assign a card to @ai with a run time, or ask the AI to schedule a job.
        </span>
      ) : (
        <div className="sched-tiles">
          {slots.map((s) => (
            <Tile key={s.key} slot={s} now={now} />
          ))}
        </div>
      )}
    </Card>
  )
}

function Tile({ slot, now }: { slot: Slot; now: Date }) {
  const kind = slot.kind === 'card' ? 'Card' : 'Job'
  let cls = 'tile'
  let label = kind
  let icon: ReactNode = <IconClock size={13} sw={1.6} />
  let sub = slot.title
  switch (slot.state) {
    case 'ok':
    case 'failed':
    case 'timeout':
    case 'skipped': {
      cls = 'tile past'
      const word = { ok: 'ok', failed: 'failed', timeout: 'timed out', skipped: 'skipped' }[slot.state]
      sub = `${slot.title} · ${word}`
      icon =
        slot.state === 'ok' ? (
          <IconCheck size={13} sw={2} />
        ) : slot.state === 'skipped' ? (
          <IconSkip size={13} sw={1.8} />
        ) : (
          <IconCross size={13} sw={2} stroke="var(--danger)" />
        )
      break
    }
    case 'running':
      cls = 'tile running'
      label = `${kind} · running`
      icon = <IconSpin size={13} sw={2} />
      break
    case 'next':
      cls = 'tile sel'
      label = `Next · ${until(slot.time, now)}`
      break
  }
  return (
    <div className={cls}>
      <div className="row between">
        <span className="mono-s">{label}</span>
        {icon}
      </div>
      <span className="tn">{hhmm(slot.time)}</span>
      <span className="small trunc">{sub}</span>
    </div>
  )
}

// ── my cards ───────────────────────────────────────────────────────────────

function MyCards({ ws, data, now }: { ws: string; data: WorkspaceData; now: Date }) {
  const mine = myCards(data.cards)
  const me = data.people.find((p) => p.id === 'me')
  const initials = (me?.name ?? 'Me')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const target = mine[0] ? `${boardUrl(ws, mine[0].board.path)}?who=me` : wsUrl(ws, 'boards')
  return (
    <Card title="My cards" meta="@me" className="c-mine">
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
        <span className="av av-me">{initials}</span>
        <span className="num">{pad2(mine.length)}</span>
      </div>
      <div className="col">
        {!mine.length && <span className="lr small muted">Nothing assigned to you.</span>}
        {mine.slice(0, 3).map((c) => {
          const d = c.card.due ? dueDate(c.card.due) : null
          const over = d && d < now
          return (
            <Link
              key={c.ref}
              to={`${boardUrl(ws, c.board.path)}?card=${encodeURIComponent(c.card.file)}`}
              className="lr"
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
            >
              <span className="trunc" style={{ maxWidth: '100%' }}>
                {c.card.title}
              </span>
              {over && d ? (
                <span className="mono-s danger-t row g4">
                  <IconWarn />
                  Overdue · {dayLabel(d)}
                </span>
              ) : (
                <span className="mono-s muted">{d ? dayLabel(d) : 'No due date'}</span>
              )}
            </Link>
          )
        })}
      </div>
      {mine.length > 0 && (
        <Link to={target} className="link" style={{ marginTop: 10 }}>
          [View all {mine.length} ↗]
        </Link>
      )}
    </Card>
  )
}

// ── AI runs this week ──────────────────────────────────────────────────────

const MAX_DOTS = 8

function RunsThisWeek({ data, now }: { data: WorkspaceData; now: Date }) {
  const monday = startOfWeek(now)
  const next = upcoming(data.jobs, data.cards, now)
  const running = runningCards(data.cards).length
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const runs = data.runs.filter((r) => sameDay(r.time, day))
    const count = (s: string) => runs.filter((r) => r.run.status === s).length
    return {
      day,
      ok: count('ok'),
      fail: count('failed'),
      to: count('timeout'),
      run: sameDay(day, now) ? running : 0,
      plan: next.filter((u) => sameDay(u.time, day)).length,
    }
  })
  const week = data.runs.filter((r) => r.time >= monday)
  const total = week.filter((r) => r.run.status !== 'skipped').length
  const failed = week.filter(bad).length
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const aria = days
    .map((d, i) => {
      const parts = [
        d.ok && `${d.ok} ok`,
        d.fail && `${d.fail} failed`,
        d.to && `${d.to} timed out`,
        d.run && `${d.run} running`,
        d.plan && `${d.plan} planned`,
      ].filter(Boolean)
      return `${names[i]} ${parts.join(' ') || 'none'}`
    })
    .join('; ')

  return (
    <Card title="AI runs this week" meta={`${total} runs · ${failed} failed`} className="c-dots">
      <div className="dots" role="img" aria-label={`Runs per day: ${aria}`}>
        {days.map((d) => {
          const dots = [
            ...Array(d.ok).fill('ok'),
            ...Array(d.to).fill('to'),
            ...Array(d.fail).fill('fail'),
            ...Array(d.run).fill('ok pulse'),
            ...Array(d.plan).fill('plan'),
          ].slice(0, MAX_DOTS)
          return (
            <div key={d.day.getTime()} className="dcol">
              {dots.map((c, i) => (
                <i key={i} className={`dd ${c}`} />
              ))}
            </div>
          )
        })}
      </div>
      <div className="xlab mono-s muted" style={{ marginTop: 8 }}>
        {letters.map((l, i) => (
          <span key={names[i]} style={sameDay(days[i].day, now) ? { color: 'var(--ink)' } : undefined}>
            {l}
          </span>
        ))}
      </div>
      <div className="row g12 wrap mono-s muted" style={{ marginTop: 14 }}>
        <span className="row g4">
          <i className="dd ok" style={{ width: 10, height: 10 }} />
          OK
        </span>
        <span className="row g4">
          <i className="dd fail" style={{ width: 10, height: 10 }} />
          Failed
        </span>
        <span className="row g4">
          <i className="dd to" style={{ width: 10, height: 10 }} />
          Timeout
        </span>
        <span className="row g4">
          <i className="dd plan" style={{ width: 10, height: 10 }} />
          Planned
        </span>
      </div>
    </Card>
  )
}

// ── workload heatmap ───────────────────────────────────────────────────────

const HOURS = [8, 10, 12, 14, 16, 18, 20]

function Workload({ data, now }: { data: WorkspaceData; now: Date }) {
  const monday = startOfWeek(now)
  const end = addDays(monday, 7)
  const grid = HOURS.map(() => Array(7).fill(0) as number[])
  const add = (d: Date) => {
    if (d < monday || d >= end) return
    const h = d.getHours()
    if (h < 8 || h >= 22) return
    grid[Math.floor((h - 8) / 2)][(d.getDay() + 6) % 7]++
  }
  for (const r of data.runs) add(r.time)
  for (const u of upcoming(data.jobs, data.cards, now)) add(u.time)
  for (const c of data.cards) if (c.card.due && c.card.due.length > 10) add(new Date(c.card.due))

  const todayCol = (now.getDay() + 6) % 7
  const nowRow = now.getHours() >= 8 && now.getHours() < 22 ? Math.floor((now.getHours() - 8) / 2) : -1
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <Card title="Workload" meta="AI runs + due cards · this week" className="c-heat">
      <div className="heat" role="img" aria-label="Workload heatmap by hour and weekday">
        <span />
        {names.map((n, i) => (
          <span key={n} className={`mono-s${i === todayCol ? '' : ' muted'}`} style={{ textAlign: 'center' }}>
            {n}
          </span>
        ))}
        {HOURS.map((h, r) => (
          <HeatRow key={h} label={pad2(h)} cells={grid[r]} now={r === nowRow ? todayCol : -1} />
        ))}
      </div>
      <div className="row g16 mono-s muted" style={{ marginTop: 14 }}>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-0)' }} />
          Free
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-1)' }} />
          Light
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-2)' }} />
          Busy
        </span>
        <span className="row g6">
          <i className="sw" style={{ background: 'var(--heat-3)' }} />
          Full
        </span>
        <span className="row g6" style={{ marginLeft: 'auto' }}>
          <i className="sw" style={{ outline: '1.5px solid var(--ink)', outlineOffset: 1 }} />
          Now
        </span>
      </div>
    </Card>
  )
}

function HeatRow({ label, cells, now }: { label: string; cells: number[]; now: number }) {
  return (
    <>
      <span className="mono-s muted" style={{ alignSelf: 'center' }}>
        {label}
      </span>
      {cells.map((v, i) => (
        <i
          key={i}
          className={`hc l${Math.min(v, 3)}${i === now ? ' now' : ''}`}
          title={`${v} item${v === 1 ? '' : 's'}`}
        />
      ))}
    </>
  )
}

// ── recently edited ────────────────────────────────────────────────────────

function RecentlyEdited({ ws, data, now }: { ws: string; data: WorkspaceData; now: Date }) {
  const boards = new Set(data.boards.map((b) => b.path))
  const byRef = new Map(data.cards.map((c) => [c.ref, c]))
  return (
    <Card
      title="Recently edited"
      meta={
        <Link to={wsUrl(ws, 'files')} className="link">
          [All files ↗]
        </Link>
      }
      className="c-recent"
    >
      <div className="col">
        {!data.recent.length && <span className="lr small muted">No files yet.</span>}
        {data.recent.slice(0, 4).map((f) => {
          const i = f.path.lastIndexOf('/')
          const dir = i < 0 ? '' : f.path.slice(0, i + 1)
          const card = byRef.get(f.path)
          const inBoard = boards.has(f.path.slice(0, Math.max(i, 0)))
          const ai = card?.card.ai
          const aiWriting = ai?.state === 'running'
          // "Edited by AI" only when the file's last write is the AI run finishing, not a later edit.
          const aiEdited =
            ai?.state === 'done' && ai.finishedAt && Math.abs(new Date(ai.finishedAt).getTime() - f.mtime) < 5 * 60_000
          return (
            <div key={f.path} className="lr">
              {inBoard ? <IconBoard size={15} sw={1.3} /> : <IconFile size={15} sw={1.3} />}
              <span className="grow trunc">
                {dir && <span className="muted">{dir}</span>}
                {f.name}
              </span>
              {aiWriting ? (
                <span className="aimark">
                  <IconSpin size={10} sw={2.2} />
                  AI writing
                </span>
              ) : aiEdited ? (
                <span className="aimark">
                  <IconSpark size={10} />
                  Edited by AI
                </span>
              ) : null}
              {(aiWriting || aiEdited) && <span className="sep">|</span>}
              <span className="mono-s muted" style={{ width: 96 }}>
                {aiWriting ? 'Now' : ago(new Date(f.mtime), now)}
              </span>
              <Link to={fileUrl(ws, f.path)} className="link">
                [Open ↗]
              </Link>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
