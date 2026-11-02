import { useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { wait } from '../helpers/async'
import { errorMessage } from '../helpers/format'
import { useShell } from '../shell/ShellContext'

/** How long to wait for the scheduler to start a run (it scans every 5 s). */
const START_TIMEOUT_MS = 30_000

/**
 * Run a job now and open its AI session in the chat beside the page, to watch it work. The scheduler (another process) starts
 * the run a few seconds after the request; its session shows up in the job's `running`.
 */
export function useRunJob(ws: string) {
  const qc = useQueryClient()
  const shell = useShell()
  const toast = useToast()
  return async (name: string, start: () => Promise<unknown> = () => api.runJob(ws, name)) => {
    try {
      await start()
    } catch (err) {
      toast(errorMessage(err), 'bad')
      return
    }
    toast('Starting… opening the session')
    for (let waited = 0; waited < START_TIMEOUT_MS; waited += 1000) {
      await wait(1000)
      const rows = await qc.fetchQuery({ queryKey: ['jobs', ws], queryFn: () => api.jobs(ws), staleTime: 0 })
      const running = rows.find((r) => r.name === name)?.running
      if (running) {
        shell.openSession(running.sessionId)
        return
      }
    }
    toast('Still queued after 30 s: is the scheduler running?', 'bad')
  }
}
