import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api, ApiError } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import { workoutUrl } from '../helpers/urls'
import { useShell } from '../shell/ShellContext'

/**
 * Start a workout (from a routine, or empty) and open it. Only one can be in progress: when one
 * already is, that one opens instead.
 */
export function useStartWorkout(ws: string) {
  const shell = useShell()
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const start = async (routine?: string) => {
    setBusy(true)
    try {
      const workout = await api.startWorkout(ws, routine)
      await qc.invalidateQueries({ queryKey: ['training', ws] })
      shell.open(workoutUrl(ws, workout.file))
    } catch (err) {
      const active = err instanceof ApiError && err.status === 409 ? (await api.trainingToday(ws)).active : null
      if (active) {
        toast('A workout is already in progress — here it is.', 'quiet')
        shell.open(workoutUrl(ws, active.file))
      } else toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return { start, busy }
}
