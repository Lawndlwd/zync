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
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-zinc-300">Today's Sessions</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {stats.sessionCount} session{stats.sessionCount !== 1 ? 's' : ''} — {formatTokens(stats.total)} tokens
          {stats.cost > 0 && ` — $${stats.cost.toFixed(4)}`}
        </p>
      </div>
    </div>
  )
}
