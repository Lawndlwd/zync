import type { SocialPost } from '@zync/shared/types'
import { SocialPostCard } from './social-post-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PostSort = 'recent' | 'oldest' | 'most_likes' | 'most_comments' | 'most_engagement'

const sortOptions: Array<{ value: PostSort; label: string }> = [
  { value: 'recent', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_likes', label: 'Most Likes' },
  { value: 'most_comments', label: 'Most Comments' },
  { value: 'most_engagement', label: 'Most Engagement' },
]

interface SocialFeedProps {
  posts: SocialPost[]
  isLoading: boolean
  onPostClick?: (post: SocialPost) => void
  sort: PostSort
  onSortChange: (sort: PostSort) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function SocialFeed({ posts, isLoading, onPostClick, sort, onSortChange, page, totalPages, onPageChange }: SocialFeedProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        Loading posts...
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <p className="text-sm">No posts yet</p>
        <p className="text-xs mt-1">Connect your account in Settings and trigger a sync</p>
      </div>
    )
  }

  return (
    <div>
      {/* Sort bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                sort === opt.value
                  ? 'bg-white/[0.08] text-zinc-100'
                  : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {totalPages > 1 && (
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {posts.map((post) => (
          <SocialPostCard
            key={`${post.platform}-${post.id}`}
            post={post}
            onClick={() => onPostClick?.(post)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<Array<number | 'ellipsis'>>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
              acc.push(p)
              return acc
            }, [])
            .map((item, i) =>
              item === 'ellipsis' ? (
                <span key={`e${i}`} className="px-1 text-xs text-zinc-600">...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={cn(
                    'min-w-[28px] rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                    page === item
                      ? 'bg-white/[0.1] text-zinc-100'
                      : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300'
                  )}
                >
                  {item}
                </button>
              )
            )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
