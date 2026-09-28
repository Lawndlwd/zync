import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useToast } from '../components/Dialog'
import { BRIEF_JOB } from '../helpers/briefs'
import { errorMessage } from '../helpers/format'
import { wsUrl } from '../helpers/urls'
import { useBriefJob } from '../hooks/useBriefJob'
import { useRunJob } from '../hooks/useRunJob'
import { useShell } from '../shell/ShellContext'

/** Set up the daily-brief job, or run it now; its time and pause live on the Jobs page. */
export function BriefSetup({ ws, canRun, hasBrief }: { ws: string; canRun: boolean; hasBrief: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const job = useBriefJob(ws)
  const runJob = useRunJob(ws)
  const shell = useShell()
  const [busy, setBusy] = useState(false)

  const act = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast(done)
      await qc.invalidateQueries({ queryKey: ['jobs', ws] })
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (job === undefined) return null
  if (job === null)
    return (
      <div className="row g8 wrap">
        <Button
          variant="primary"
          size="sm"
          busy={busy}
          onClick={() => void act(() => api.enableBriefJob(ws), 'Daily brief on: every day at 07:00')}
        >
          Turn on daily brief
        </Button>
        <span className="small muted">
          Every morning the AI reads your calendar, mail and messages and suggests the day’s to-dos.
        </span>
      </div>
    )
  const running = job.running
  return (
    <div className="row g8 wrap">
      {running ? (
        <Button size="sm" onClick={() => shell.openSession(running.sessionId)}>
          [↗] Writing… watch it
        </Button>
      ) : (
        canRun && (
          <Button
            size="sm"
            busy={busy}
            onClick={() => {
              setBusy(true)
              void runJob(BRIEF_JOB).finally(() => setBusy(false))
            }}
          >
            {hasBrief ? 'Write it again' : 'Write it now'}
          </Button>
        )
      )}
      <Link className="link" to={wsUrl(ws, 'jobs')}>
        [{job.job?.enabled === false ? 'Paused' : 'Daily'} · {job.job?.schedule ?? ''} ↗]
      </Link>
    </div>
  )
}
