import { useState, useEffect, useCallback } from 'react'
import { Loader2, Send, Instagram, Twitter, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSocialFilter } from '@/store/social-filter'
import type { SocialComment } from '@/types/social'
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

const platformBadge: Record<string, { icon: typeof Instagram; className: string }> = {
  instagram: { icon: Instagram, className: 'text-pink-400 bg-pink-500/10' },
  x: { icon: Twitter, className: 'text-sky-400 bg-sky-500/10' },
  youtube: { icon: Youtube, className: 'text-red-400 bg-red-500/10' },
}

export function SocialInbox() {
  const { platform, accountIds } = useSocialFilter()
  const [comments, setComments] = useState<SocialComment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [replyStates, setReplyStates] = useState<Record<number, { text: string; open: boolean; loading: boolean }>>({})

  const fetchComments = useCallback(() => {
    setLoading(true)
    const statusParam = filter === 'all' ? undefined : filter
    const accountId = accountIds.length === 1 ? accountIds[0] : undefined
    socialService.getComments({ platform: platform ?? undefined, status: statusParam, limit: 100, sort: 'recent', accountId })
      .then((result) => setComments(result.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [platform, accountIds, filter])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleReply = async (comment: SocialComment, text: string) => {
    setReplyStates((s) => ({ ...s, [comment.id]: { ...s[comment.id], loading: true } }))
    try {
      await socialService.replyToComment(comment.id, text, comment.platform, comment.external_id)
      toast.success('Reply sent')
      setReplyStates((s) => ({ ...s, [comment.id]: { text: '', open: false, loading: false } }))
      fetchComments()
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Inbox</h2>
        <div className="flex gap-1">
          {filterConfig.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.id ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 text-sm">No comments found</div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {comments.map((comment) => {
            const badge = statusBadge[comment.reply_status] || statusBadge.pending
            const platBadge = platformBadge[comment.platform]
            const PlatIcon = platBadge?.icon
            const rs = replyStates[comment.id]
            return (
              <div key={comment.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  {PlatIcon && (
                    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', platBadge.className)}>
                      <PlatIcon size={10} />{comment.platform}
                    </span>
                  )}
                  <span className="text-xs font-medium text-zinc-300">@{comment.author}</span>
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium ml-auto', badge.className)}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-2">{comment.content}</p>

                {comment.reply_content && (
                  <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 px-3 py-2 mb-2">
                    <p className="text-[10px] text-zinc-500 mb-0.5">Reply:</p>
                    <p className="text-xs text-zinc-300">{comment.reply_content}</p>
                  </div>
                )}

                {(comment.reply_status === 'pending' || comment.reply_status === 'flagged') && (
                  <div>
                    {!rs?.open ? (
                      <button onClick={() => toggleReply(comment.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Reply</button>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={rs?.text || ''}
                          onChange={(e) => setReplyStates((s) => ({ ...s, [comment.id]: { ...s[comment.id], text: e.target.value } }))}
                          placeholder="Type reply..."
                          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none"
                          onKeyDown={(e) => { if (e.key === 'Enter' && rs?.text.trim()) handleReply(comment, rs.text) }}
                        />
                        <Button
                          size="sm"
                          onClick={() => rs?.text.trim() && handleReply(comment, rs.text)}
                          disabled={!rs?.text.trim() || rs?.loading}
                        >
                          {rs?.loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 text-[10px] text-zinc-600">
                  {new Date(comment.created_at).toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
