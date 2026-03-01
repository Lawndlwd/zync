import {
  GitMerge, GitPullRequest, Clock, Eye, CircleDot,
  XCircle, Lock, FileEdit, AlertTriangle, Percent, MessageSquare,
} from 'lucide-react'
import type { MRMetrics } from '@/lib/gitlab-stats'

interface StatsCardsProps {
  metrics: MRMetrics
}

export function GitLabStatsCards({ metrics }: StatsCardsProps) {
  const cards = [
    { label: 'Created', value: metrics.created, icon: GitPullRequest, color: 'text-indigo-400' },
    { label: 'Merged', value: metrics.merged, icon: GitMerge, color: 'text-emerald-400' },
    { label: 'Open', value: metrics.open, icon: CircleDot, color: 'text-sky-400' },
    { label: 'Closed', value: metrics.closed, icon: XCircle, color: 'text-red-400' },
    { label: 'Locked', value: metrics.locked, icon: Lock, color: 'text-zinc-400' },
    { label: 'Drafts', value: metrics.drafts, icon: FileEdit, color: 'text-orange-400' },
    { label: 'Conflicts', value: metrics.withConflicts, icon: AlertTriangle, color: 'text-rose-400' },
    { label: 'Merge Rate', value: `${metrics.mergeRate.toFixed(0)}%`, icon: Percent, color: 'text-teal-400' },
    { label: 'Avg Merge Time', value: formatMergeTime(metrics.avgMergeTimeHours), icon: Clock, color: 'text-amber-400' },
    { label: 'Comments', value: metrics.commentsReceived, icon: MessageSquare, color: 'text-pink-400' },
    { label: 'Reviews Done', value: metrics.reviewsDone, icon: Eye, color: 'text-violet-400' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <card.icon size={16} className={card.color} />
            <span className="text-sm text-zinc-500">{card.label}</span>
          </div>
          <p className="text-base font-semibold text-zinc-100 truncate">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

function formatMergeTime(hours: number | null): string {
  if (hours === null) return '--'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}
