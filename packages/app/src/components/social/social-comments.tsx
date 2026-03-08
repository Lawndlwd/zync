import type { SocialComment } from '@zync/shared/types'
import { SocialCommentCard } from './social-comment-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CommentSort = 'recent' | 'oldest'

const sortOptions: Array<{ value: CommentSort; label: string }> = [
  { value: 'recent', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

const statusFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'auto_replied', label: 'Auto-replied' },
  { id: 'manual_replied', label: 'Replied' },
] as const

interface SocialCommentsProps {
  comments: SocialComment[]
  isLoading: boolean
  onReply: (id: number, text: string) => void
  sort: CommentSort
  onSortChange: (sort: CommentSort) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  statusCounts: Record<string, number>
}

export function SocialComments({
  comments, isLoading, onReply,
  sort, onSortChange,
  page, totalPages, onPageChange,
  statusFilter, onStatusFilterChange, statusCounts,
}: SocialCommentsProps) {
  return (
    <div>
      {/* Filters + sort row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => onStatusFilterChange(f.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === f.id
                  ? 'bg-white/[0.08] text-zinc-100'
                  : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
              )}
            >
              {f.label}
              {f.id !== 'all' && (statusCounts[f.id] ?? 0) > 0 && (
                <span className="ml-1 text-zinc-600">
                  ({statusCounts[f.id]})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
              Page {page}/{totalPages}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">No comments found</div>
      ) : (
        <div className="grid gap-3">
          {comments.map((comment) => (
            <SocialCommentCard key={`${comment.platform}-${comment.id}`} comment={comment} onReply={onReply} />
          ))}
        </div>
      )}

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
