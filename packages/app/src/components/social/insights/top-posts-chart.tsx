const compact = new Intl.NumberFormat('en-US', { notation: 'compact' })

interface PostData {
  id: number
  external_id: string
  content: string
  media_url: string | null
  permalink: string | null
  reach: number
  impressions: number
  engagement: number
  engagement_rate: number
  like_count: number
  comments_count: number
  shares_count: number
  saves_count: number
}

interface Props {
  data: PostData[]
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300">{value}</span>
    </div>
  )
}

export function TopPostsChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">No post data</p>
      </div>
    )
  }

  const posts = data.slice(0, 5)
  const maxEngagement = posts[0]?.engagement ?? 1

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-400 mb-3">Top Posts</p>
      <div className="flex flex-col gap-3">
        {posts.map((post) => {
          const relativeBar = maxEngagement > 0 ? (post.engagement / maxEngagement) * 100 : 0
          const card = (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors">
              <div className="flex gap-3 mb-2">
                {post.media_url && (
                  <img
                    src={post.media_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                )}
                <p className="text-xs text-zinc-300 line-clamp-2 flex-1 min-w-0">
                  {post.content || 'No caption'}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                <Metric label="Reach" value={compact.format(post.reach)} />
                <Metric label="Eng. Rate" value={`${post.engagement_rate.toFixed(1)}%`} />
                <Metric label="Likes" value={compact.format(post.like_count)} />
                <Metric label="Comments" value={compact.format(post.comments_count)} />
                <Metric label="Shares" value={compact.format(post.shares_count)} />
                <Metric label="Saves" value={compact.format(post.saves_count)} />
              </div>
              <div className="h-1 w-full rounded-full bg-white/[0.04]">
                <div
                  className="h-1 rounded-full bg-indigo-500"
                  style={{ width: `${relativeBar}%` }}
                />
              </div>
            </div>
          )

          if (post.permalink) {
            return (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {card}
              </a>
            )
          }

          return <div key={post.id}>{card}</div>
        })}
      </div>
    </div>
  )
}
