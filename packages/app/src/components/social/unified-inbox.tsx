import { useState, useEffect } from 'react'
import { Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { SocialComment, SocialPlatform } from '@zync/shared/types'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

type InboxFilter = 'all' | 'pending' | 'flagged' | 'auto_replied' | 'manual_replied'

const filterConfig: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'auto_replied', label: 'Auto-replied' },
  { id: 'manual_replied', label: 'Replied' },
]

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-amber-400 bg-amber-500/10' },
  flagged: { label: 'Flagged', className: 'text-rose-400 bg-rose-500/10' },
  auto_replied: { label: 'Auto', className: 'text-emerald-400 bg-emerald-500/10' },
  manual_replied: { label: 'Replied', className: 'text-blue-400 bg-blue-500/10' },
}

interface UnifiedInboxProps {
  platform: SocialPlatform
  refreshKey: number
  onRefresh: () => void
}

export function UnifiedInbox({ platform, refreshKey, onRefresh }: UnifiedInboxProps) {
  const [comments, setComments] = useState<SocialComment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [replyStates, setReplyStates] = useState<Record<number, { text: string; open: boolean; loading: boolean }>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const statusParam = filter === 'all' ? undefined : filter
    socialService.getComments({ platform, status: statusParam, limit: 50, sort: 'recent' })
      .then((result) => {
        if (!cancelled) setComments(result.items)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [platform, filter, refreshKey])

  const handleReply = async (comment: SocialComment, text: string) => {
    setReplyStates((s) => ({ ...s, [comment.id]: { ...s[comment.id], loading: true } }))
    try {
      await socialService.replyToComment(comment.id, text, comment.platform, comment.external_id)
      toast.success('Reply sent')
      setReplyStates((s) => ({ ...s, [comment.id]: { text: '', open: false, loading: false } }))
      onRefresh()
    } catch {
      toast.error('Reply failed')
      setReplyStates((s) => ({ ...s, [comment.id]: { ...s[comment.id], loading: false } }))
    }
  }

  const toggleReply = (id: number) => {
    setReplyStates((s) => ({
      ...s,
      [id]: { text: s[id]?.text || '', open: !s[id]?.open, loading: false },
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-zinc-200 mb-3">Inbox</h2>

      <div className="flex gap-1 mb-3 flex-wrap">
        {filterConfig.map((f) => (
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
        ) : comments.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-xs">
            No comments found
          </div>
        ) : (
          comments.map((comment) => {
            const badge = statusBadge[comment.reply_status] || statusBadge.pending
            const rs = replyStates[comment.id]
            return (
              <div
                key={comment.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-300">@{comment.author}</span>
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-2">{comment.content}</p>

                {comment.reply_content && (
                  <div className="rounded-md bg-indigo-500/5 border border-indigo-500/10 px-2.5 py-1.5 mb-2">
                    <p className="text-[10px] text-zinc-500 mb-0.5">Reply:</p>
                    <p className="text-xs text-zinc-300">{comment.reply_content}</p>
                  </div>
                )}

                {(comment.reply_status === 'pending' || comment.reply_status === 'flagged') && (
                  <div>
                    {!rs?.open ? (
                      <button
                        onClick={() => toggleReply(comment.id)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Reply
                      </button>
                    ) : (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          type="text"
                          value={rs?.text || ''}
                          onChange={(e) => setReplyStates((s) => ({ ...s, [comment.id]: { ...s[comment.id], text: e.target.value } }))}
                          placeholder="Type reply..."
                          className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && rs?.text.trim()) handleReply(comment, rs.text)
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => rs?.text.trim() && handleReply(comment, rs.text)}
                          disabled={!rs?.text.trim() || rs?.loading}
                        >
                          {rs?.loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-1.5 text-[10px] text-zinc-600">
                  {new Date(comment.created_at).toLocaleString()}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
