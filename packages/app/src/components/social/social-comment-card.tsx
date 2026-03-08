import { useState } from 'react'
import type { SocialComment } from '@zync/shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'text-amber-400 bg-amber-500/10' },
  flagged: { label: 'Flagged', className: 'text-rose-400 bg-rose-500/10' },
  auto_replied: { label: 'Auto-replied', className: 'text-emerald-400 bg-emerald-500/10' },
  manual_replied: { label: 'Replied', className: 'text-blue-400 bg-blue-500/10' },
}

const platformColors: Record<string, string> = {
  instagram: 'text-pink-400',
  x: 'text-zinc-100',
  youtube: 'text-red-400',
}

interface SocialCommentCardProps {
  comment: SocialComment
  onReply: (id: number, text: string) => void
}

export function SocialCommentCard({ comment, onReply }: SocialCommentCardProps) {
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const badge = statusBadge[comment.reply_status] || statusBadge.pending

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', platformColors[comment.platform])}>
            {comment.platform}
          </span>
          <span className="text-sm font-medium text-zinc-300">@{comment.author}</span>
        </div>
        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', badge.className)}>
          {badge.label}
        </span>
      </div>

      <p className="text-sm text-zinc-400 mb-2">{comment.content}</p>

      {comment.reply_content && (
        <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 px-3 py-2 mb-2">
          <p className="text-xs text-zinc-500 mb-0.5">Reply:</p>
          <p className="text-sm text-zinc-300">{comment.reply_content}</p>
        </div>
      )}

      {(comment.reply_status === 'pending' || comment.reply_status === 'flagged') && (
        <>
          {!showReply ? (
            <Button variant="ghost" size="sm" onClick={() => setShowReply(true)}>
              Reply
            </Button>
          ) : (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && replyText.trim()) {
                    onReply(comment.id, replyText)
                    setReplyText('')
                    setShowReply(false)
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (replyText.trim()) {
                    onReply(comment.id, replyText)
                    setReplyText('')
                    setShowReply(false)
                  }
                }}
                disabled={!replyText.trim()}
              >
                <Send size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      <div className="mt-2 text-xs text-zinc-600">
        {new Date(comment.created_at).toLocaleString()} · Post: {comment.post_external_id}
      </div>
    </div>
  )
}
