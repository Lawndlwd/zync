import { useState } from 'react'
import { Link } from 'react-router'

import { Select } from '../components/Select'
import { StatusBadge } from '../components/StatusBadge'
import { runningCards } from '../helpers/boards'
import { addDays, dayLabel, hhmm, relativeDayTime, startOfDay } from '../helpers/dates'
import { formatDuration } from '../helpers/format'
import { sessionUrl } from '../helpers/urls'
import type { JobRow } from '../types/jobs'
import type { BoardCard, RunEvent } from '../types/workspace'

export function RunHistory({
  ws,
  runs,
  jobs,
  cards,
}: {
  ws: string
  runs: RunEvent[]
  jobs: JobRow[]
  cards: BoardCard[]
}) {
  const [job, setJob] = useState('__all')
  const [range, setRange] = useState('7')
  const now = new Date()
  const from = range === 'all' ? new Date(0) : startOfDay(addDays(now, -Number(range) + 1))
  const running = runningCards(cards)
  const shown = runs.filter((r) => r.time >= from && (job === '__all' || r.job === job)).slice(0, 100)
  const titleOf = (name: string) => runs.find((r) => r.job === name)?.title ?? name

  return (
    <section className="card plain">
      <div className="card-h">
        <span className="t">Run history</span>
        <span className="row g8">
          <Select
            compact
            ariaLabel="Job"
            className="select-inline"
            value={job}
            options={[
              { value: '__all', label: 'All jobs', text: 'all' },
              ...jobs.map((j) => ({ value: j.name, label: titleOf(j.name), text: `${j.name} ${titleOf(j.name)}` })),
            ]}
            onChange={setJob}
          />
          <Select
            compact
            ariaLabel="Range"
            className="select-inline"
            value={range}
            options={[
              { value: '1', label: 'Today' },
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: 'all', label: 'All time' },
            ]}
            onChange={setRange}
          />
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Time</th>
              <th>Job / card</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 100 }}>Trigger</th>
              <th style={{ width: 90 }}>Duration</th>
              <th>Summary</th>
              <th style={{ width: 150 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {job === '__all' &&
              running.map((c) => (
                <tr key={`run:${c.ref}`}>
                  <td className="mono-s">{c.card.runAt ? relativeDayTime(new Date(c.card.runAt)) : 'Now'}</td>
                  <td>
                    {c.card.title} <span className="mono-s muted">card</span>
                  </td>
                  <td>
                    <StatusBadge state="running" />
                  </td>
                  <td className="mono-s muted">—</td>
                  <td className="mono-s">…</td>
                  <td className="small muted">Working…</td>
                  <td>
                    {c.card.ai?.sessionId && (
                      <Link to={sessionUrl(ws, c.card.ai.sessionId)} className="link">
                        [Open session ↗]
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            {shown.map((r) => {
              const bad = r.run.status === 'failed'
              return (
                <tr key={`${r.job}:${r.run.ts}`} className={bad ? 'hl' : undefined}>
                  <td className="mono-s">
                    {dayLabel(r.time).slice(0, 6)} · {hhmm(r.time)}
                  </td>
                  <td>
                    {r.title} {r.kind === 'card' && <span className="mono-s muted">card</span>}
                  </td>
                  <td>
                    <StatusBadge state={r.run.status} />
                  </td>
                  <td className={`mono-s${bad ? '' : ' muted'}`}>{r.run.trigger}</td>
                  <td className="mono-s">{formatDuration(r.run.durationMs)}</td>
                  <td className="small" style={{ color: bad ? 'var(--on-danger-soft)' : 'var(--ink-2)' }}>
                    <span className="clamp2">{r.run.summary}</span>
                  </td>
                  <td>
                    {r.run.sessionId && (
                      <Link to={sessionUrl(ws, r.run.sessionId)} className="link">
                        [Open session ↗]
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {!shown.length && !running.length && (
              <tr>
                <td colSpan={7} className="small muted">
                  No runs in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
