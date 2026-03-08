import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Reply, Bot } from 'lucide-react'
import type { TelegramDM } from '@/services/telegram'

const categoryBadge: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'text-red-400 bg-red-500/10' },
  business: { label: 'Business', className: 'text-blue-400 bg-blue-500/10' },
  support: { label: 'Support', className: 'text-amber-400 bg-amber-500/10' },
  spam: { label: 'Spam', className: 'text-zinc-400 bg-zinc-500/10' },
  fan: { label: 'Fan', className: 'text-emerald-400 bg-emerald-500/10' },
}

interface DMCardProps {
  dm: TelegramDM
  onReply: (id: number, text: string) => void
  replying?: boolean
}

export function DMCard({ dm, onReply, replying }: DMCardProps) {
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const badge = categoryBadge[dm.category] || { label: dm.category, className: 'text-zinc-400 bg-zinc-500/10' }

  const handleSend = () => {
    if (replyText.trim()) {
      onReply(dm.id, replyText.trim())
      setReplyText('')
      setShowReply(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {/* Header: sender + category badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-zinc-200">
            {dm.display_name || 'Unknown'}
          </span>
          {dm.username && (
            <span className="text-xs text-zinc-500">@{dm.username}</span>
          )}
        </div>
        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', badge.className)}>
          {badge.label}
        </span>
      </div>

      {/* Message body */}
      <p className="text-sm text-zinc-400 mb-2 whitespace-pre-wrap">{dm.message_text}</p>

      {/* Auto-reply display */}
      {dm.auto_replied === 1 && dm.reply_text && (
        <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 px-3 py-2 mb-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Bot size={12} className="text-zinc-500" />
            <span className="text-xs text-zinc-500">Auto-reply:</span>
          </div>
          <p className="text-sm text-zinc-300">{dm.reply_text}</p>
        </div>
      )}

      {/* Manual reply that isn't auto */}
      {dm.auto_replied === 0 && dm.reply_text && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 mb-2">
          <p className="text-xs text-zinc-500 mb-0.5">Reply:</p>
          <p className="text-sm text-zinc-300">{dm.reply_text}</p>
        </div>
      )}

      {/* Reply controls - only show if no reply yet */}
      {!dm.reply_text && (
        <>
          {!showReply ? (
            <Button variant="ghost" size="sm" onClick={() => setShowReply(true)}>
              <Reply size={14} />
              Reply
            </Button>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReply(false)
                    setReplyText('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!replyText.trim() || replying}
                >
                  <Send size={14} />
                  {replying ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Timestamp */}
      <div className="mt-2 text-xs text-zinc-600">
        {new Date(dm.created_at).toLocaleString()}
      </div>
    </div>
  )
}
