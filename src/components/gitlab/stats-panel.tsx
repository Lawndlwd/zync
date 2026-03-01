import { useState, useMemo } from 'react'
import { BarChart3, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useGitlabMRStats } from '@/hooks/useGitlab'
import { useSettingsStore } from '@/store/settings'
import { computeMetrics, computeTimeData } from '@/lib/gitlab-stats'
import { GitLabStatsCards } from './stats-cards'
import { GitLabActivityChart } from './activity-chart'
import { GitLabContributorsList } from './contributors-list'

const PERIOD_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 180 },
  { label: '1y', days: 365 },
  { label: 'All', days: 0 },
] as const

interface StatsPanelProps {
  projectId: number | null
}

export function GitLabStatsPanel({ projectId }: StatsPanelProps) {
  const username = useSettingsStore((s) => s.settings.gitlab.username)
  const [open, setOpen] = useState(true)
  const [days, setDays] = useState(90)

  const { data, isLoading } = useGitlabMRStats(projectId, username, days)

  const metrics = useMemo(
    () => (data ? computeMetrics(data.authored, data.reviewed) : null),
    [data]
  )

  const timeData = useMemo(
    () => (data ? computeTimeData(data.authored, days) : []),
    [data, days]
  )

  if (!projectId) return null

  return (
    <div className="space-y-6">
      {/* Your Stats section */}
      {username && (
        <div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 mb-3 text-base font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            <BarChart3 size={20} className="text-indigo-400" />
            Your Stats
            <ChevronDown
              size={18}
              className={`text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`}
            />
          </button>

          {open && (
            <div className="space-y-4">
              {/* Period selector */}
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setDays(opt.days)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      days === opt.days
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                  </div>
                  <Skeleton className="h-48 rounded-lg" />
                </>
              ) : metrics ? (
                <>
                  <GitLabStatsCards metrics={metrics} />
                  <GitLabActivityChart data={timeData} />
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Contributors section */}
      <GitLabContributorsList projectId={projectId} />
    </div>
  )
}
