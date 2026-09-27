import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useConfirm, useToast } from '../components/Dialog'
import { StatusBadge } from '../components/StatusBadge'
import { Toggle } from '../components/Toggle'
import { relativeDayTime } from '../helpers/dates'
import { errorMessage, formatDuration } from '../helpers/format'
import { isFailedRun } from '../helpers/runs'
import { boardUrl, fileUrl, sessionUrl } from '../helpers/urls'
import { IconBoard } from '../icons'
import type { JobRow } from '../types/jobs'
import type { BoardCard } from '../types/workspace'
import { describeSchedule } from './helpers'

const NOTIFY: Record<string, string> = { always: 'Always notify', failure: 'Only on failure', never: 'Never notify' }

export function JobCard({ ws, row, card }: { ws: string; row: JobRow; card?: BoardCard }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const job = row.job
  const last = row.lastRun
  const failed = last !== null && isFailedRun(last.status)
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      if (done) toast(done)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      void qc.invalidateQueries({ queryKey: ['jobs', ws] })
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
                  {relativeDayTime(new Date(iso))}
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
                  {relativeDayTime(new Date(last.ts))} ·{' '}
                  {failed ? last.summary.split('\n')[0] : formatDuration(last.durationMs)}
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
          <Link to={sessionUrl(ws, last.sessionId)} className="link" style={{ marginLeft: 'auto' }}>
            [{failed ? 'Failed' : 'Last'} session ↗]
          </Link>
        )}
      </div>
    </article>
  )
}
