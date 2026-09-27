import { useQueryClient } from '@tanstack/react-query'
import { type CSSProperties, useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { hhmm, pad2 } from '../helpers/dates'
import { errorMessage } from '../helpers/format'
import { isFailedRun } from '../helpers/runs'
import { wsUrl } from '../helpers/urls'
import type { Range } from '../types/overview'
import type { RunEvent, WorkspaceData } from '../types/workspace'

export function RunResults({
  ws,
  data,
  runs,
  range,
}: {
  ws: string
  data: WorkspaceData
  runs: RunEvent[]
  range: Range
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = runs.filter((r) => r.run.status === 'ok').length
  const failed = runs.filter((r) => r.run.status === 'failed')
  const timedOut = runs.filter((r) => r.run.status === 'timeout').length
  const lastFail = failed[0]
  // Retry what is still broken: jobs whose latest run failed or timed out.
  const retry = data.jobs.filter((j) => j.lastRun != null && isFailedRun(j.lastRun.status))

  const doRetry = async () => {
    setBusy(true)
    setErr('')
    try {
      for (const j of retry) {
        const card = j.job?.card ? data.cards.find((c) => c.ref === j.job?.card) : undefined
        if (card) await api.runCard(ws, card.board.path, card.card.file)
        else await api.runJob(ws, j.name)
      }
      void qc.invalidateQueries({ queryKey: ['jobs', ws] })
      void qc.invalidateQueries({ queryKey: ['board', ws] })
    } catch (caught) {
      setErr(errorMessage(caught))
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
