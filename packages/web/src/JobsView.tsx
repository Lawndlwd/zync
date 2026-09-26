import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type JobRow } from './api'
import { boardUrl } from './boards/shared'
import { Button } from './components/Button'
import { Segmented, Toggle } from './components/Controls'
import { useConfirm, useToast } from './components/Dialog'
import { Select } from './components/Select'
import { IconBoard } from './icons'
import { fileUrl, useShell, wsUrl } from './shell/context'
import { Chip, StatusBadge } from './ui'
import {
  addDays,
  type BoardCard,
  dayLabel,
  hhmm,
  type RunEvent,
  runningCards,
  sameDay,
  startOfDay,
  useWorkspaceData,
} from './workspaceData'

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

/** "Mondays 15:14", "Every day 08:00", "Once · Fri 02 Oct 09:00"; falls back to the cron text. */
function describeSchedule(job: NonNullable<JobRow['job']>): string {
  if (job.at) {
    const d = new Date(job.at)
    return Number.isNaN(d.getTime()) ? `Once · ${job.at}` : `Once · ${dayLabel(d)} ${hhmm(d)}`
  }
  const parts = job.schedule?.trim().split(/\s+/) ?? []
  if (parts.length !== 5) return job.schedule ?? '—'
  const [m, h, dom, mon, dow] = parts
  if (!/^\d+$/.test(m) || !/^\d+$/.test(h) || dom !== '*' || mon !== '*') return `cron ${job.schedule}`
  const t = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  if (dow === '*') return `Every day ${t}`
  if (dow === '1-5') return `Weekdays ${t}`
  if (/^[0-6]$/.test(dow)) return `${DAYS[Number(dow)]} ${t}`
  return `cron ${job.schedule}`
}

const when = (d: Date, now = new Date()) =>
  sameDay(d, now)
    ? `Today ${hhmm(d)}`
    : sameDay(d, addDays(now, 1))
      ? `Tomorrow ${hhmm(d)}`
      : `${dayLabel(d)} ${hhmm(d)}`

const duration = (ms?: number) => {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const NOTIFY: Record<string, string> = { always: 'Always notify', failure: 'Only on failure', never: 'Never notify' }

export function JobsView() {
  const { ws = '' } = useParams()
  const shell = useShell()
  const data = useWorkspaceData(ws)
  const [tab, setTab] = useState<'jobs' | 'history'>('jobs')
  const now = new Date()
  const failedToday = data.runs.filter(
    (r) => sameDay(r.time, now) && (r.run.status === 'failed' || r.run.status === 'timeout'),
  ).length
  const running = runningCards(data.cards).length
  const byRef = new Map(data.cards.map((c) => [c.ref, c]))

  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / jobs</span>
        <div className="row between wrap g16" style={{ alignItems: 'flex-end' }}>
          <div className="col g12">
            <h1 className="display">Jobs</h1>
            <p className="lede">
              The AI runs these on its own. Create or change one by <b>asking in chat</b>.
            </p>
          </div>
          <Button variant="primary" onClick={() => shell.dock === 'rail' && shell.toggleDock()}>
            [↗] New job in chat
          </Button>
        </div>
        <div className="row g8 wrap">
          <Segmented
            label="View"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'jobs', label: `Jobs · ${data.jobs.length}` },
              { value: 'history', label: 'Run history' },
            ]}
          />
          <span className="grow" />
          {failedToday > 0 && <Chip n={failedToday} label="Failed today" bad />}
          {running > 0 && <Chip n={running} label="Running" />}
        </div>
      </div>

      {tab === 'jobs' ? (
        data.jobs.length ? (
          <div className="jobs-grid">
            {data.jobs.map((row) => (
              <JobCard key={row.name} ws={ws} row={row} card={row.job?.card ? byRef.get(row.job.card) : undefined} />
            ))}
          </div>
        ) : (
          <section className="card plain" style={{ gap: 8 }}>
            <span className="h3">No jobs yet</span>
            <span className="small muted">
              Ask in chat, e.g. “every Monday at 15:14, summarise notes/ into reports/weekly.md”, or assign a board card
              to @ai with a run time.
            </span>
          </section>
        )
      ) : null}

      <RunHistory ws={ws} runs={data.runs} jobs={data.jobs} cards={data.cards} />
    </div>
  )
}

function JobCard({ ws, row, card }: { ws: string; row: JobRow; card?: BoardCard }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const job = row.job
  const last = row.lastRun
  const failed = last?.status === 'failed' || last?.status === 'timeout'
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      if (done) toast(done)
    } catch (e) {
      toast((e as Error).message, 'bad')
    } finally {
      qc.invalidateQueries({ queryKey: ['jobs', ws] })
    }
  }
  const title = card?.card.title ?? row.name
  const runNow = () =>
    act(
      () => (card ? api.runCard(ws, card.board.path, card.card.file) : api.runJob(ws, row.name)),
      `${title} · queued — starts within a few seconds`,
    )

  return (
    <article className="card" style={{ gap: 14, ...(failed || row.error ? { borderColor: 'var(--danger)' } : {}) }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="col g8" style={{ minWidth: 0 }}>
          <h2 className="h3 trunc">{title}</h2>
          {job && (
            <div className="row g8 wrap">
              <span className="pill" style={{ height: 26 }}>
                {describeSchedule(job)}
              </span>
              <span className="mono-s muted">
                {job.schedule ? `cron ${job.schedule} · ` : ''}
                {job.timezone ?? ''}
              </span>
            </div>
          )}
        </div>
        {job && (
          <span className="row g8">
            <span className="mono-s">{job.enabled ? 'On' : 'Off'}</span>
            <Toggle
              label={`${row.name} enabled`}
              checked={job.enabled}
              onChange={(v) => act(() => api.setJobEnabled(ws, row.name, v), v ? 'Job enabled' : 'Job paused')}
            />
          </span>
        )}
      </div>
      {row.error && (
        <p className="small danger-t" style={{ margin: 0 }}>
          Invalid job file: {row.error}
        </p>
      )}
      {card ? (
        <Link
          to={`${boardUrl(ws, card.board.path)}?card=${encodeURIComponent(card.card.file)}`}
          className="row g8 small linked-card"
        >
          <IconBoard size={13} />
          Linked to card{' '}
          <b style={{ fontWeight: 600 }}>
            {card.board.name} / {card.card.title}
          </b>{' '}
          ↗
        </Link>
      ) : (
        job && (
          <p className="small clamp2" style={{ margin: 0 }}>
            {job.instructions}
          </p>
        )
      )}
      {job && (
        <div className="job-meta">
          <div className="col g4">
            <span className="flabel">{row.nextRuns.length > 1 ? 'Next runs' : 'Next run'}</span>
            {row.nextRuns.length ? (
              row.nextRuns.slice(0, 3).map((iso, i) => (
                <span key={iso} className={`mono-s${i ? ' muted' : ''}`}>
                  {when(new Date(iso))}
                </span>
              ))
            ) : (
              <span className="mono-s muted">{job.at ? '— done' : 'None'}</span>
            )}
          </div>
          <div className="col g6">
            <span className="flabel">Last run</span>
            {last ? (
              <>
                <span style={{ alignSelf: 'flex-start' }}>
                  <StatusBadge state={last.status} />
                </span>
                <span className={`mono-s ${failed ? 'danger-t' : 'muted'} clamp2`}>
                  {when(new Date(last.ts))} · {failed ? last.summary.split('\n')[0] : duration(last.durationMs)}
                </span>
              </>
            ) : (
              <span className="mono-s muted">Never run</span>
            )}
          </div>
          <div className="col g6">
            <span className="flabel">Context · notify</span>
            <span className="row g4 wrap">
              {job.context.length ? (
                job.context.map((c) => (
                  <span key={c} className="tag" style={{ height: 22 }}>
                    {c}
                  </span>
                ))
              ) : (
                <span className="mono-s muted">Whole workspace</span>
              )}
            </span>
            <span className="mono-s muted">{card ? 'Move card to Review' : (NOTIFY[job.notify] ?? job.notify)}</span>
          </div>
        </div>
      )}
      <div className="row g8">
        <Button variant="primary" size="sm" onClick={() => void runNow()}>
          {failed ? '[↻] Retry' : '[▶] Run now'}
        </Button>
        {card ? (
          <Link
            to={`${boardUrl(ws, card.board.path)}?card=${encodeURIComponent(card.card.file)}`}
            className="btn btn-ghost btn-sm"
          >
            Edit on card
          </Link>
        ) : (
          <>
            <Link to={fileUrl(ws, `.opencode/jobs/${row.name}.md`)} className="btn btn-ghost btn-sm">
              Edit
            </Link>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${row.name}?`,
                  body: 'The job file and its run history are removed. This cannot be undone.',
                  confirmLabel: 'Delete job',
                  destructive: true,
                })
                if (ok) void act(() => api.deleteJob(ws, row.name), `Deleted ${row.name}`)
              }}
            >
              Delete
            </Button>
          </>
        )}
        {last?.sessionId && (
          <Link
            to={wsUrl(ws, `chat?session=${encodeURIComponent(last.sessionId)}`)}
            className="link"
            style={{ marginLeft: 'auto' }}
          >
            [{failed ? 'Failed' : 'Last'} session ↗]
          </Link>
        )}
      </div>
    </article>
  )
}

function RunHistory({ ws, runs, jobs, cards }: { ws: string; runs: RunEvent[]; jobs: JobRow[]; cards: BoardCard[] }) {
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
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {job === '__all' &&
              running.map((c) => (
                <tr key={`run:${c.ref}`}>
                  <td className="mono-s">{c.card.runAt ? when(new Date(c.card.runAt)) : 'Now'}</td>
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
                      <Link to={wsUrl(ws, `chat?session=${encodeURIComponent(c.card.ai.sessionId)}`)} className="link">
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
                  <td className="mono-s">{duration(r.run.durationMs)}</td>
                  <td className="small" style={{ color: bad ? 'var(--on-danger-soft)' : 'var(--ink-2)' }}>
                    <span className="clamp2">{r.run.summary}</span>
                  </td>
                  <td>
                    {r.run.sessionId && (
                      <Link to={wsUrl(ws, `chat?session=${encodeURIComponent(r.run.sessionId)}`)} className="link">
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
