import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useSocialFilter } from '@/store/social-filter'
import * as socialService from '@/services/social'
import { DMInbox as TelegramDMInbox } from '@/components/telegram/dm-inbox'
import { SocialPlatformTabs, type SocialTab } from '@/components/social/social-platform-tabs'
import { KpiCard } from '@/components/social/insights/kpi-card'
import { ReachImpressionsChart } from '@/components/social/insights/reach-impressions-chart'
import { FollowerGrowthChart } from '@/components/social/insights/follower-growth-chart'
import { EngagementBreakdownChart } from '@/components/social/insights/engagement-breakdown-chart'
import { EngagementRateChart } from '@/components/social/insights/engagement-rate-chart'
import { PostingHeatmap } from '@/components/social/insights/posting-heatmap'
import { TopPostsChart } from '@/components/social/insights/top-posts-chart'
import { PlatformComparisonChart } from '@/components/social/insights/platform-comparison-chart'
import { PostFrequencyChart } from '@/components/social/insights/post-frequency-chart'

const timeRanges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 9999 },
]

export function SocialDashboard() {
  const { platform, accountIds } = useSocialFilter()
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<SocialTab>('feed')

  const accountId = accountIds.length === 1 ? accountIds[0] : undefined

  const { data: insights, isLoading } = useQuery({
    queryKey: ['social-insights', platform, accountId, days],
    queryFn: () => socialService.getInsights(platform ?? 'all', days, accountId),
    staleTime: 60_000,
  })

  return (
    <div>
      <SocialPlatformTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'telegram' && <TelegramDMInbox />}

      {activeTab !== 'telegram' && (
      <>
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
      ) : insights ? (
        <>
          {/* Row 1: KPI cards */}
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              title="Followers"
              value={insights.summary.followers}
              delta={insights.summary.followersDelta}
              sparklineData={insights.sparklines.followers}
              format="compact"
            />
            <KpiCard
              title="Engagement Rate"
              value={insights.summary.engagementRate}
              delta={insights.summary.engagementRateDelta}
              sparklineData={insights.sparklines.engagementRate}
              format="percent"
            />
            <KpiCard
              title="Total Reach"
              value={insights.summary.totalReach}
              delta={insights.summary.reachDelta}
              sparklineData={insights.sparklines.reach}
              format="compact"
            />
            <KpiCard
              title="Impressions"
              value={insights.summary.totalImpressions}
              delta={insights.summary.impressionsDelta}
              sparklineData={insights.sparklines.impressions}
              format="compact"
            />
            <KpiCard
              title="Posts Published"
              value={insights.summary.postsPublished}
              delta={insights.summary.postsDelta}
              sparklineData={insights.sparklines.posts}
              format="number"
            />
          </div>

          {/* Row 2: Reach & Impressions + Follower Growth */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ReachImpressionsChart data={insights.reachAndImpressions} />
            <FollowerGrowthChart data={insights.followerGrowth} prevData={insights.followerGrowthPrev} />
          </div>

          {/* Row 3: Engagement Breakdown + Engagement Rate */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <EngagementBreakdownChart data={insights.engagementBreakdown} />
            <EngagementRateChart data={insights.engagementRateOverTime} />
          </div>

          {/* Row 4: Posting Heatmap + Top Posts */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <PostingHeatmap data={insights.postingHeatmap} />
            <TopPostsChart data={insights.topPosts} />
          </div>

          {/* Row 5: Platform Comparison + Post Frequency */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {insights.platformComparison.length > 0 && (
              <PlatformComparisonChart data={insights.platformComparison} />
            )}
            <PostFrequencyChart data={insights.postFrequency} />
          </div>
        </>
      ) : null}
      </>
      )}
    </div>
  )
}
