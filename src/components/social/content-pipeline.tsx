import { useState, useEffect } from 'react'
import { Plus, Loader2, Heart, MessageCircle, Clock, CheckCircle2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialPost, SocialPlatform } from '@/types/social'
import * as socialService from '@/services/social'

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'published'

const statusConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  draft: { icon: FileText, color: 'text-zinc-400 bg-zinc-500/10', label: 'Draft' },
  scheduled: { icon: Clock, color: 'text-blue-400 bg-blue-500/10', label: 'Scheduled' },
  published: { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10', label: 'Published' },
}

interface ContentPipelineProps {
  platform: SocialPlatform
  onNewPost: () => void
  onPostClick?: (post: SocialPost) => void
  refreshKey: number
}

export function ContentPipeline({ platform, onNewPost, onPostClick, refreshKey }: ContentPipelineProps) {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const statusParam = filter === 'all' ? undefined : filter
    socialService.getPosts({ platform, status: statusParam, limit: 50, sort: 'recent' })
      .then((result) => {
        if (!cancelled) setPosts(result.items)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [platform, filter, refreshKey])

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'published', label: 'Published' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-200">Content Pipeline</h2>
        <button
          onClick={onNewPost}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus size={12} />
          New Post
        </button>
      </div>

      <div className="flex gap-1 mb-3">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              filter === f.id ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-xs">
            No posts found
          </div>
        ) : (
          posts.map((post) => {
            const sc = statusConfig[post.status] || statusConfig.draft
            const Icon = sc.icon
            return (
              <div
                key={post.id}
                onClick={() => onPostClick?.(post)}
                className="cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start gap-2">
                  {post.media_url && (
                    <img
                      src={post.media_url}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 line-clamp-2">
                      {post.content || 'No caption'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', sc.color)}>
                        <Icon size={10} />
                        {sc.label}
                      </span>
                      {post.status === 'published' && (
                        <>
                          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                            <Heart size={10} />{post.like_count}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                            <MessageCircle size={10} />{post.comments_count}
                          </span>
                        </>
                      )}
                      {post.scheduled_for && (
                        <span className="text-[10px] text-zinc-500 ml-auto">
                          {new Date(post.scheduled_for).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
