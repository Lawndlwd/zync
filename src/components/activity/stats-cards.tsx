import { useQuery } from '@tanstack/react-query'
import { fetchActivityStats } from '@/services/activity'
import { Zap, Hash, Cpu, DollarSign } from 'lucide-react'

interface StatsCardsProps {
  days: number
  source?: string
}

export function StatsCards({ days, source }: StatsCardsProps) {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', days],
    queryFn: () => fetchActivityStats(days),
    staleTime: 60_000,
  })

  const filteredBySource = stats?.bySource ?? []
  const sourceData = source && source !== 'all'
    ? filteredBySource.filter((s) => s.source === source)
    : filteredBySource

  const totalTokens = sourceData.reduce((sum, s) => sum + s.total_tokens, 0)
  const totalCalls = sourceData.reduce((sum, s) => sum + s.calls, 0)
  const totalCost = sourceData.reduce((sum, s) => sum + (s.cost || 0), 0)

  const cards = [
    {
      label: 'Total Tokens',
      value: stats ? formatNumber(totalTokens) : '—',
      icon: Zap,
      color: 'text-indigo-400',
    },
    {
      label: 'Total Calls',
      value: stats ? String(totalCalls) : '—',
      icon: Hash,
      color: 'text-emerald-400',
    },
    {
      label: 'Top Model',
      value: stats?.byModel[0]?.model ?? '—',
      icon: Cpu,
      color: 'text-amber-400',
    },
    {
      label: 'Est. Cost',
      value: totalCost > 0 ? `$${totalCost.toFixed(4)}` : '$0.00',
      icon: DollarSign,
      color: 'text-sky-400',
    },
  ]

  return (
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
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
