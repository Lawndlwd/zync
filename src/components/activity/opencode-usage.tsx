import { useAllSessionsTokens, type SessionSource } from '@/hooks/useOpenCode'
import { DASHBOARD_SESSION_PREFIX } from '@/services/opencode'
import { Zap, DollarSign, Hash, Cpu } from 'lucide-react'
import { relativeTime } from '@/lib/utils'

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

interface OpenCodeUsageProps {
  days?: number
  source?: SessionSource
  title?: string
}

export function OpenCodeUsage({ days, source = 'all', title }: OpenCodeUsageProps) {
  const stats = useAllSessionsTokens(days, source)

  if (stats.sessionCount === 0) return null

  const topModel = stats.models[0] ?? '—'

  const cards = [
    { label: 'Sessions', value: String(stats.sessionCount), icon: Hash, color: 'text-indigo-400' },
    { label: 'Total Tokens', value: formatTokens(stats.total), icon: Zap, color: 'text-emerald-400' },
    { label: 'Total Cost', value: stats.cost > 0 ? `$${stats.cost.toFixed(4)}` : '$0.00', icon: DollarSign, color: 'text-amber-400' },
    { label: 'Top Model', value: topModel, icon: Cpu, color: 'text-sky-400' },
  ]

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          {title}
        </h3>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={14} className={card.color} />
              <span className="text-xs text-zinc-500">{card.label}</span>
            </div>
            <p className="text-lg font-semibold text-zinc-100 truncate">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Per-session breakdown */}
      {stats.perSession.length > 0 && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
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
      )}
    </div>
  )
}
