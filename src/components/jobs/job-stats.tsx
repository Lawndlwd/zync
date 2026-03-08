import { useJobStats } from '@/hooks/useJobs'
import { BarChart3, Star, Layers, ThumbsUp } from 'lucide-react'

interface JobStatsProps {
  campaignId?: number
}

const statCards = [
  { key: 'total_jobs', label: 'Total Jobs', icon: Layers, color: 'text-indigo-400' },
  { key: 'avg_score', label: 'Avg Score', icon: Star, color: 'text-amber-400' },
  { key: 'shortlisted_count', label: 'Shortlisted', icon: ThumbsUp, color: 'text-emerald-400' },
] as const

export function JobStatsBar({ campaignId }: JobStatsProps) {
  const { data: stats } = useJobStats(campaignId)
  if (!stats) return null

  const sourceEntries = Object.entries(stats.by_source)

  return (
    <div className="flex items-center gap-4">
      {statCards.map(({ key, label, icon: Icon, color }) => (
        <div key={key} className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs text-zinc-500">{label}:</span>
          <span className="text-sm font-medium text-zinc-200">
            {stats[key] ?? '-'}
          </span>
        </div>
      ))}
      {sourceEntries.length > 0 && (
        <div className="flex items-center gap-2 border-l border-white/[0.08] pl-4">
          <BarChart3 size={14} className="text-zinc-500" />
          {sourceEntries.map(([source, count]) => (
            <span key={source} className="text-xs text-zinc-500">
              {source}: <span className="text-zinc-300">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
