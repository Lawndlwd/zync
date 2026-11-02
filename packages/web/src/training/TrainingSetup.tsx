import { dateTimeLabel } from '../helpers/dates'
import { useNow } from '../hooks/useNow'
import { useTrainingProfile } from '../hooks/useTrainingProfile'
import { useShell } from '../shell/ShellContext'
import { SetupWizard } from './SetupWizard'

/** `training/setup`: the profile the AI plans from, as a short form. Open it again to change it. */
export function TrainingSetup() {
  const { ws } = useShell()
  const now = useNow(60_000)
  const { data, error, isLoading } = useTrainingProfile(ws)

  return (
    <div className="page col g20" style={{ padding: '28px 32px 32px' }}>
      <div className="col g12">
        <div className="row between">
          <span className="mono muted">{ws} / training / setup</span>
          <span className="mono muted">{dateTimeLabel(now)}</span>
        </div>
        <h1 className="display" style={{ fontSize: 44 }}>
          {data ? 'Training setup' : 'Set up Training'}
        </h1>
        <p className="lede" style={{ fontSize: 16 }}>
          A few answers, and the AI builds routines around your goal, your equipment and your week.
        </p>
      </div>
      {error && <p className="lede danger-t">{error.message}</p>}
      {isLoading && <div className="skel" style={{ height: 320 }} />}
      {data !== undefined && <SetupWizard key={data?.setupAt ?? 'new'} ws={ws} profile={data} />}
    </div>
  )
}
