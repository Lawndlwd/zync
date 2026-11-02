import { useState } from 'react'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import { useShell } from '../shell/ShellContext'

/** "Start with the AI": a chat that asks who you want to become and writes the identity page. */
export function useBecomingInterview(ws: string) {
  const shell = useShell()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      const { sessionId } = await api.becomingInterview(ws)
      shell.openSession(sessionId)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return { start, busy }
}
