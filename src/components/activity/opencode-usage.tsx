import { useAllSessionsTokens, type SessionSource } from '@/hooks/useOpenCode'
import { Zap, DollarSign, Hash, Cpu } from 'lucide-react'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
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
    </div>
  )
}
