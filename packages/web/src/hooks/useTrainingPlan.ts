import { useState } from 'react'

import { api, ApiError } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import { useShell } from '../shell/ShellContext'

/** "Build my plan with AI": a chat that designs routines from the training profile. */
export function useTrainingPlan(ws: string) {
  const shell = useShell()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      const { sessionId } = await api.trainingPlan(ws)
      shell.openSession(sessionId)
    } catch (err) {
      const offline = err instanceof ApiError && err.status === 503
      toast(offline ? 'The AI server isn’t set up, so it can’t build a plan right now.' : errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return { start, busy }
}
