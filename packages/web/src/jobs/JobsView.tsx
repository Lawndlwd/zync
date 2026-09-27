import { useState } from 'react'
import { useParams } from 'react-router'

import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Segmented } from '../components/Segmented'
import { runningCards } from '../helpers/boards'
import { sameDay } from '../helpers/dates'
import { isFailedRun } from '../helpers/runs'
import { useWorkspaceData } from '../hooks/useWorkspaceData'
import { useShell } from '../shell/ShellContext'
import { JobCard } from './JobCard'
import { RunHistory } from './RunHistory'

export function JobsView() {
  const { ws = '' } = useParams()
  const shell = useShell()
  const data = useWorkspaceData(ws)
  const [tab, setTab] = useState<'jobs' | 'history'>('jobs')
  const now = new Date()
  const failedToday = data.runs.filter((r) => sameDay(r.time, now) && isFailedRun(r.run.status)).length
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
