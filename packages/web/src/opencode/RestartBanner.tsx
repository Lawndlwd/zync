import { Button } from '../components/Button'
import { usePendingRestart } from '../hooks/usePendingRestart'
import { useRestart } from '../hooks/useRestart'

export function RestartBanner() {
  const [pending] = usePendingRestart()
  const { busy, restart } = useRestart()
  if (!pending) return null
  return (
    <div className="card soft row between wrap g12 oc-banner" role="status">
      <span className="small">Saved. The AI server picks up agents, commands and skills when it starts.</span>
      <Button size="sm" variant="primary" busy={busy} onClick={() => void restart()}>
        {busy ? 'Restarting…' : '[↻] Restart AI server'}
      </Button>
    </div>
  )
}
