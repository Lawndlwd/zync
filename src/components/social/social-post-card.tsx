import { useState } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SocialPost } from '@/types/social'
import { useCrossPostToTelegram } from '@/hooks/useTelegram'

export function SocialPostCard({ post, onClick }: { post: SocialPost; onClick?: () => void }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = post.media_url && !imgError
  const crossPost = useCrossPostToTelegram()

  const handleCrossPost = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!post.content) return
    crossPost.mutate(
      { content: post.content, mediaUrl: post.media_url || undefined },
      {
        onSuccess: () => toast.success('Posted to Telegram'),
        onError: () => toast.error('Failed to post to Telegram'),
      }
    )
  }

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
      onClick={onClick}
    >
      {hasImage && (
        <div className="aspect-square w-full overflow-hidden bg-zinc-900">
          <img
            src={post.media_url!}
            alt={post.content?.slice(0, 80) || 'Post'}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="p-3">
        {post.content && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{post.content}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Heart size={12} />
            {post.like_count ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} />
            {post.comments_count ?? 0}
          </span>
          <button
            onClick={handleCrossPost}
            disabled={crossPost.isPending || !post.content}
            className="flex items-center gap-1 text-zinc-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
            title="Post to Telegram"
          >
            <Send size={12} />
          </button>
          {post.posted_at && (
            <span className="ml-auto">
              {new Date(post.posted_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
