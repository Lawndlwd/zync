import { useAllSessionsTokens, useOpenCodeStatus } from '@/hooks/useOpenCode'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function LiveSessions() {
  const { data: status } = useOpenCodeStatus()
  const stats = useAllSessionsTokens(1) // today's sessions only

  if (!status?.connected || stats.sessionCount === 0) return null

  return (
    <div className="rounded-lg bg-card border border-border overflow-hidden">
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-foreground">Today's Sessions</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {stats.sessionCount} session{stats.sessionCount !== 1 ? 's' : ''} — {formatTokens(stats.total)} tokens
          {stats.cost > 0 && ` — $${stats.cost.toFixed(4)}`}
        </p>
      </div>
    </div>
  )
}
