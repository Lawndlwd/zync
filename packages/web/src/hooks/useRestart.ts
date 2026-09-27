import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import { PENDING_RESTART } from './usePendingRestart'

export function useRestart() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const restart = async () => {
    setBusy(true)
    try {
      const h = await api.restartOpencode()
      qc.setQueryData(['opencode-health'], h)
      qc.setQueryData(PENDING_RESTART, false)
      toast(`AI server restarted${h.version ? ` · v${h.version}` : ''}`)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return { busy, restart }
}
