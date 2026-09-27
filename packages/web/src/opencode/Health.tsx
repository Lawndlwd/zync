import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { useRestart } from '../hooks/useRestart'

export function Health() {
  const health = useQuery({ queryKey: ['opencode-health'], queryFn: api.opencodeHealth, refetchInterval: 10_000 })
  const { busy, restart } = useRestart()
  const h = health.data
  return (
    <span className="row g8">
      {h?.healthy ? (
        <StatusBadge state="ok">Running{h.version ? ` · v${h.version}` : ''}</StatusBadge>
      ) : health.isLoading ? (
        <StatusBadge state="scheduled">Checking</StatusBadge>
      ) : (
        <StatusBadge state="failed">Unreachable</StatusBadge>
      )}
      <Button size="sm" variant="soft" busy={busy} onClick={() => void restart()}>
        {busy ? 'Restarting…' : '[↻] Restart'}
      </Button>
    </span>
  )
}
