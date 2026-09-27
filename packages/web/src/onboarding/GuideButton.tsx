import { Button } from '../components/Button'
import { ProgressRing } from '../components/ProgressRing'
import { useOnboarding } from '../hooks/useOnboarding'
import { useOpenGuide } from '../hooks/useOpenGuide'
import type { WorkspaceData } from '../types/workspace'

/** The folded "Get started" checklist in the top bar: its progress, and a way back to it. */
export function GuideButton({ ws, data }: { ws: string; data: WorkspaceData }) {
  const openGuide = useOpenGuide(ws)
  const { steps, done, complete, state } = useOnboarding(ws, data)
  if (state !== 'minimized' || complete) return null
  return (
    <Button
      size="sm"
      className="guide-btn hide-narrow"
      aria-label={`Get started: ${done} of ${steps.length} done`}
      onClick={openGuide}
    >
      <ProgressRing value={done} total={steps.length} size={18} />
      Get started {done}/{steps.length}
    </Button>
  )
}
