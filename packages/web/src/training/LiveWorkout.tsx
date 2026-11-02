import { useParams } from 'react-router'

import { useTrainingProfile } from '../hooks/useTrainingProfile'
import { useWorkout } from '../hooks/useWorkout'
import { useShell } from '../shell/ShellContext'
import { WorkoutEditor } from './WorkoutEditor'

/** The workout page (`training/workout/:file`): logging a session live, or fixing a logged one. */
export function LiveWorkout() {
  const { ws } = useShell()
  const file = useParams().file ?? ''
  const { data, error, isLoading } = useWorkout(ws, file)
  const profile = useTrainingProfile(ws)
  const units = profile.data?.units ?? 'kg'

  if (error)
    return (
      <div className="page">
        <p className="lede danger-t">{error.message}</p>
      </div>
    )
  if (isLoading || !data)
    return (
      <div className="page">
        <div className="skel" style={{ height: 320 }} />
      </div>
    )
  return <WorkoutEditor key={`${ws}:${file}`} ws={ws} workout={data} units={units} />
}
