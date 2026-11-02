import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import type { Workout, WorkoutUpdate } from '../types/training'
import { useDebouncedSave } from './useDebouncedSave'

/**
 * A workout being logged: the sets and notes change locally at once and are saved to its file
 * after a pause. Key the caller by the workout's file so a new workout starts a new draft.
 */
export function useWorkoutEditor(ws: string, workout: Workout) {
  const qc = useQueryClient()
  const toast = useToast()
  const [draft, setDraft] = useState<WorkoutUpdate>({ exercises: workout.exercises, notes: workout.notes })
  const saver = useDebouncedSave<WorkoutUpdate>(800)

  const save = async (update: WorkoutUpdate) => {
    try {
      const saved = await api.saveWorkout(ws, workout.file, update)
      qc.setQueryData(['training', ws, 'workout', workout.file], saved)
    } catch (err) {
      toast(errorMessage(err), 'bad')
      throw err
    }
  }

  const change = (next: WorkoutUpdate) => {
    setDraft(next)
    saver.schedule(workout.file, next, save)
  }

  return { draft, change, saving: saver.pending, flush: saver.flush, cancel: saver.cancel }
}
