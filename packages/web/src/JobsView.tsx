import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type JobRow, type RunRecord } from './api'

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function JobsView() {
  const { ws = '' } = useParams()
  const { data, error, isLoading } = useQuery({
    queryKey: ['jobs', ws],
    queryFn: () => api.jobs(ws),
    refetchInterval: 15_000,
  })

  return (
    <div className="page">
      <h2>Scheduled jobs</h2>
      <p className="muted">
        Ask in <Link to="../chat">Chat</Link>, e.g. “every Monday at 15:14, summarise notes/ into reports/weekly.md”.
        The AI asks what it needs, then creates the job. Job files live in <code>.opencode/jobs/</code>.
      </p>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      {data && !data.length && <p className="muted">No jobs in this workspace yet.</p>}
      {data?.map((row) => (
        <JobCard key={row.name} ws={ws} row={row} />
      ))}
    </div>
  )
}

function JobCard({ ws, row }: { ws: string; row: JobRow }) {
  const qc = useQueryClient()
  const [showRuns, setShowRuns] = useState(false)
  const [msg, setMsg] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: ['jobs', ws] })
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      setMsg(done ?? '')
      refresh()
    } catch (e) {
      setMsg((e as Error).message)
    }
  }
  const job = row.job
  const fileLink = `../files/.opencode/jobs/${encodeURIComponent(row.name)}.md`

  return (
    <div className={`card ${job && !job.enabled ? 'disabled' : ''}`}>
      <div className="card-head">
        <strong>{row.name}</strong>
        {job && <span className="pill">{job.schedule ? `cron ${job.schedule}` : `once ${job.at}`}</span>}
        {job?.timezone && <span className="muted small">{job.timezone}</span>}
        <span className="spacer" />
        {job && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={job.enabled}
              onChange={(e) => act(() => api.setJobEnabled(ws, row.name, e.target.checked))}
            />{' '}
            enabled
          </label>
        )}
        <button onClick={() => act(() => api.runJob(ws, row.name), 'Queued — starts within a few seconds.')}>
          Run now
        </button>
        <Link to={fileLink}>Edit</Link>
        <button
          onClick={() => confirm(`Delete job ${row.name} and its history?`) && act(() => api.deleteJob(ws, row.name))}
        >
          Delete
        </button>
      </div>
      {row.error && <p className="error small">Invalid job file: {row.error}</p>}
      {job && (
        <>
          <p className="instructions">{job.instructions}</p>
          <div className="meta small">
            <span>
              Next: {row.nextRuns.length ? row.nextRuns.map(fmt).join(' · ') : <em className="muted">none</em>}
            </span>
            {row.lastRun && (
              <span>
                Last: <RunBadge run={row.lastRun} /> {fmt(row.lastRun.ts)}
              </span>
            )}
            {job.context.length > 0 && <span>Context: {job.context.join(', ')}</span>}
            <span>Notify: {job.notify}</span>
          </div>
        </>
      )}
      {msg && <p className="small muted">{msg}</p>}
      <button className="link" onClick={() => setShowRuns((s) => !s)}>
        {showRuns ? 'Hide history' : 'Show history'}
      </button>
      {showRuns && <Runs ws={ws} name={row.name} />}
    </div>
  )
}

function Runs({ ws, name }: { ws: string; name: string }) {
  const { data } = useQuery({ queryKey: ['runs', ws, name], queryFn: () => api.runs(ws, name) })
  if (!data) return null
  if (!data.length) return <p className="muted small">No runs yet.</p>
  return (
    <table className="runs">
      <tbody>
        {data.map((r) => (
          <tr key={r.ts}>
            <td className="nowrap">{fmt(r.ts)}</td>
            <td>
              <RunBadge run={r} />
            </td>
            <td className="muted small nowrap">
              {r.trigger}
              {r.durationMs ? ` · ${Math.round(r.durationMs / 1000)}s` : ''}
            </td>
            <td className="summary">{r.summary}</td>
            <td className="nowrap">
              {r.sessionId && <Link to={`../chat?session=${encodeURIComponent(r.sessionId)}`}>Open session</Link>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RunBadge({ run }: { run: RunRecord }) {
  return <span className={`badge ${run.status}`}>{run.status}</span>
}
