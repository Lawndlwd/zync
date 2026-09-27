import { useLocation, useNavigate } from 'react-router'

import { useToast } from '../components/Dialog'
import { IconButton } from '../components/IconButton'
import { ProgressRing } from '../components/ProgressRing'
import { TextButton } from '../components/TextButton'
import { stepGuide } from '../helpers/onboarding'
import { useOnboarding } from '../hooks/useOnboarding'
import { IconCheck, IconCross } from '../icons'
import { useShell } from '../shell/ShellContext'
import type { StepId } from '../types/onboarding'
import type { WorkspaceData } from '../types/workspace'

/**
 * The "Get started" checklist on the Overview. Each mission ticks itself when it is really done in
 * the workspace; "Show me" opens the right page and spotlights the control to use.
 */
export function GettingStarted({ ws, data }: { ws: string; data: WorkspaceData }) {
  const shell = useShell()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { steps, done, complete, state, setState } = useOnboarding(ws, data)
  if (state !== 'open') return null

  const showMe = (id: StepId) => {
    const guide = stepGuide(id, ws, data)
    if (location.pathname !== guide.to) void navigate(guide.to)
    shell.showTip(guide.tip)
  }
  const next = steps.find((s) => !s.done)

  if (complete)
    return (
      <section className="card gs gs-done" aria-label="Get started">
        <div className="gs-head">
          <ProgressRing value={done} total={steps.length} />
          <div className="col g4 grow">
            <span className="h3">You’re all set</span>
            <span className="small muted">You’ve tried everything zync does. ⌘K is there whenever you need it.</span>
          </div>
          <TextButton onClick={() => setState('closed')}>[Close]</TextButton>
        </div>
      </section>
    )

  return (
    <section className="card gs" aria-label="Get started">
      <div className="gs-head">
        <ProgressRing value={done} total={steps.length} />
        <div className="col g4 grow">
          <span className="h3">Get started with zync</span>
          <span className="small muted">
            Six things that show what zync does. Each one ticks itself when you do it.
          </span>
        </div>
        <span className="mono-s muted">
          {done}/{steps.length}
        </span>
        <IconButton
          label="Dismiss getting started"
          small
          onClick={() => {
            setState('closed')
            toast('Guide closed — reopen it any time from ⌘K or your account menu')
          }}
        >
          <IconCross size={12} />
        </IconButton>
      </div>
      <ol className="gs-steps">
        {steps.map((s) => (
          <li key={s.id} className={`gs-step${s.done ? ' done' : ''}${s === next ? ' next' : ''}`}>
            <span className="gs-dot">{s.done && <IconCheck size={11} sw={2} />}</span>
            <span className="grow">{s.title}</span>
            {!s.done && <TextButton onClick={() => showMe(s.id)}>[Show me →]</TextButton>}
          </li>
        ))}
      </ol>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <TextButton className="muted" onClick={() => setState('minimized')}>
          [Hide for now]
        </TextButton>
      </div>
    </section>
  )
}
