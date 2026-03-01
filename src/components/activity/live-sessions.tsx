import { useAllSessionsTokens, useOpenCodeStatus } from '@/hooks/useOpenCode'
import { DASHBOARD_SESSION_PREFIX } from '@/services/opencode'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function displayTitle(title: string): string {
  return title.startsWith(DASHBOARD_SESSION_PREFIX)
    ? title.slice(DASHBOARD_SESSION_PREFIX.length)
    : title
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function LiveSessions() {
  const { data: status } = useOpenCodeStatus()
  const stats = useAllSessionsTokens(1) // today's sessions only

  if (!status?.connected || stats.sessionCount === 0) return null

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-sm font-medium text-zinc-300">Today's Live Sessions</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {stats.sessionCount} session{stats.sessionCount !== 1 ? 's' : ''} — {formatTokens(stats.total)} tokens
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Session</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Model</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Input</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Output</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Cost</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Updated</th>
          </tr>
        </thead>
        <tbody>
          {stats.perSession.map((s) => (
            <tr key={s.id} className="border-b border-white/[0.04] last:border-0">
              <td className="px-4 py-3 text-zinc-200 truncate max-w-[200px]">{displayTitle(s.title)}</td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs truncate max-w-[120px]">
                {s.models[0] ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-zinc-400">{formatTokens(s.input)}</td>
              <td className="px-4 py-3 text-right text-zinc-400">{formatTokens(s.output)}</td>
              <td className="px-4 py-3 text-right text-amber-400">
                {s.cost > 0 ? `$${s.cost.toFixed(4)}` : '—'}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600 text-xs">
                {relativeTime(s.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
