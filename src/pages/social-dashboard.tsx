import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Heart, MessageCircle, FileText, TrendingUp } from 'lucide-react'
import { useSocialFilter } from '@/store/social-filter'
import * as socialService from '@/services/social'

import { EngagementChart } from '@/components/social/insights/engagement-chart'
import { PostFrequencyChart } from '@/components/social/insights/post-frequency-chart'
import { TopPostsChart } from '@/components/social/insights/top-posts-chart'
import { CommentStatusChart } from '@/components/social/insights/comment-status-chart'
import { PostingHeatmap } from '@/components/social/insights/posting-heatmap'
import { GrowthChart } from '@/components/social/insights/growth-chart'

const timeRanges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function SocialDashboard() {
  const { platform, accountIds } = useSocialFilter()
  const [days, setDays] = useState(30)

  const accountId = accountIds.length === 1 ? accountIds[0] : undefined

  const { data: insights, isLoading } = useQuery({
    queryKey: ['social-insights', platform, accountId, days],
    queryFn: () => socialService.getInsights(platform ?? 'instagram', days, accountId),
    staleTime: 60_000,
  })

  const totalPosts = insights?.topPosts.length ?? 0
  const totalLikes = insights?.engagementOverTime.reduce((s, d) => s + d.likes, 0) ?? 0
  const totalComments = insights?.engagementOverTime.reduce((s, d) => s + d.comments, 0) ?? 0
  const avgEngagement = totalPosts > 0 ? Math.round((totalLikes + totalComments) / totalPosts) : 0

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Analytics</h2>
        <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {timeRanges.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                days === r.days ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-500" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: FileText, label: 'Posts', value: totalPosts },
              { icon: Heart, label: 'Total Likes', value: totalLikes.toLocaleString() },
              { icon: MessageCircle, label: 'Total Comments', value: totalComments.toLocaleString() },
              { icon: TrendingUp, label: 'Avg Engagement', value: avgEngagement.toLocaleString() },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                  <stat.icon size={14} />
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className="text-lg font-semibold text-zinc-100">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            <EngagementChart data={insights?.engagementOverTime ?? []} />
            <PostFrequencyChart data={insights?.postFrequency ?? []} />
            <TopPostsChart data={insights?.topPosts ?? []} />
            <CommentStatusChart data={insights?.commentStatusBreakdown ?? []} />
            <PostingHeatmap data={insights?.postingHeatmap ?? []} />
            <GrowthChart data={insights?.growthOverTime ?? []} />
          </div>
        </>
      )}
    </div>
  )
}
