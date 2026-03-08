import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTelegramDMs, useTelegramDMStats, useReplyToDM } from '@/hooks/useTelegram'
import { DMCard } from './dm-card'
import { Inbox, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const categories = [
  { key: undefined, label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'business', label: 'Business' },
  { key: 'support', label: 'Support' },
  { key: 'fan', label: 'Fan' },
  { key: 'spam', label: 'Spam' },
] as const

export function DMInbox() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined)
  const { data: dms, isLoading, error } = useTelegramDMs(activeCategory)
  const { data: stats } = useTelegramDMStats()
  const replyMutation = useReplyToDM()

  const handleReply = (id: number, text: string) => {
    replyMutation.mutate(
      { id, text },
      {
        onSuccess: () => toast.success('Reply sent'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to send reply'),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.key
          const count = cat.key ? stats?.byCategory[cat.key] ?? 0 : stats?.total ?? 0

          return (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white/[0.08] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              )}
            >
              {cat.label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                  isActive ? 'bg-white/[0.1] text-zinc-300' : 'bg-white/[0.04] text-zinc-600'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading messages...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/10 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load messages'}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && dms?.dms?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Inbox size={32} className="mb-3" />
          <p className="text-sm">No messages{activeCategory ? ` in ${activeCategory}` : ''}</p>
        </div>
      )}

      {/* DM list */}
      {dms?.dms && dms.dms.length > 0 && (
        <div className="flex flex-col gap-3">
          {dms.dms.map((dm) => (
            <DMCard
              key={dm.id}
              dm={dm}
              onReply={handleReply}
              replying={replyMutation.isPending && replyMutation.variables?.id === dm.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
