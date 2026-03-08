import { useState, useEffect } from 'react'
import { ArrowLeft, Heart, MessageCircle, ExternalLink, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SocialPost, SocialComment } from '@zync/shared/types'
import * as socialService from '@/services/social'
import { cn } from '@/lib/utils'

interface PostDetailProps {
  post: SocialPost
  onBack: () => void
}

export function SocialPostDetail({ post, onBack }: PostDetailProps) {
  const [comments, setComments] = useState<SocialComment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    socialService.getComments({ platform: post.platform, post_external_id: post.external_id })
      .then((result) => setComments(result.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [post.external_id])

  const handleReply = async (commentId: number, externalId: string) => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      await socialService.replyToComment(commentId, replyText, 'instagram', externalId)
      setReplyText('')
      setReplyTo(null)
      // Refresh comments
      const updated = await socialService.getComments({ platform: post.platform, post_external_id: post.external_id })
      setComments(updated.items)
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to posts
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image */}
        <div>
          {post.media_url && (
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900">
              <img
                src={post.media_url}
                alt={post.content?.slice(0, 80) || 'Post'}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Details + Comments */}
        <div>
          {/* Engagement stats */}
          <div className="flex items-center gap-4 mb-4">
            <span className="flex items-center gap-1.5 text-sm text-zinc-300">
              <Heart size={16} className="text-pink-400" />
              {post.like_count ?? 0} likes
            </span>
            <span className="flex items-center gap-1.5 text-sm text-zinc-300">
              <MessageCircle size={16} className="text-blue-400" />
              {post.comments_count ?? 0} comments
            </span>
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
              >
                <ExternalLink size={14} />
                View original
              </a>
            )}
          </div>

          {/* Caption */}
          {post.content && (
            <p className="text-sm text-zinc-300 mb-1">{post.content}</p>
          )}
          {post.posted_at && (
            <p className="text-xs text-zinc-600 mb-4">
              {new Date(post.posted_at).toLocaleString()}
            </p>
          )}

          {/* Comments */}
          <div className="border-t border-white/[0.06] pt-4">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Comments {!loading && `(${comments.length})`}
            </h3>

            {loading ? (
              <p className="text-xs text-zinc-500">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-zinc-500">No comments on this post</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-zinc-200">{c.author}</span>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                      <span className={cn(
                        'ml-auto text-[10px] rounded px-1.5 py-0.5',
                        c.reply_status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                        c.reply_status === 'auto_replied' || c.reply_status === 'manual_replied' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-zinc-500/10 text-zinc-400'
                      )}>
                        {c.reply_status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">{c.content}</p>

                    {c.reply_content && (
                      <div className="mt-2 pl-3 border-l-2 border-pink-500/30">
                        <p className="text-xs text-zinc-400">{c.reply_content}</p>
                      </div>
                    )}

                    {c.reply_status === 'pending' && (
                      <div className="mt-2">
                        {replyTo === c.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleReply(c.id, c.external_id)}
                              placeholder="Write a reply..."
                              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-pink-500/30 focus:outline-none"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(c.id, c.external_id)}
                              disabled={sending || !replyText.trim()}
                              className="h-7 px-2"
                            >
                              <Send size={12} />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyTo(c.id)}
                            className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
