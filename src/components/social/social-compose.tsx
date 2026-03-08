import { useState } from 'react'
import type { SocialPlatform } from '@/types/social'
import { Button } from '@/components/ui/button'
import { Send, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const platforms: { id: SocialPlatform; label: string; color: string }[] = [
  { id: 'instagram', label: 'Instagram', color: 'border-pink-500/30 text-pink-400' },
  { id: 'x', label: 'X', color: 'border-zinc-500/30 text-zinc-100' },
  { id: 'youtube', label: 'YouTube', color: 'border-red-500/30 text-red-400' },
]

interface SocialComposeProps {
  onPost: (platform: SocialPlatform, content: string, scheduledFor?: string) => void
}

export function SocialCompose({ onPost }: SocialComposeProps) {
  const [platform, setPlatform] = useState<SocialPlatform>('x')
  const [content, setContent] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)

  const charLimit = platform === 'x' ? 280 : undefined

  const handlePost = () => {
    if (!content.trim()) return
    onPost(platform, content, scheduledFor || undefined)
    setContent('')
    setScheduledFor('')
    setShowSchedule(false)
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex gap-2 mb-3">
        {platforms.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              platform === p.id ? p.color : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Write your ${platform} post...`}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none resize-none"
        rows={4}
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          {charLimit && (
            <span className={cn('text-xs', content.length > charLimit ? 'text-rose-400' : 'text-zinc-500')}>
              {content.length}/{charLimit}
            </span>
          )}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <Calendar size={12} />
            Schedule
          </button>
        </div>
        <Button size="sm" onClick={handlePost} disabled={!content.trim() || (charLimit != null && content.length > charLimit)}>
          <Send size={14} className="mr-1.5" />
          {scheduledFor ? 'Schedule' : 'Save Draft'}
        </Button>
      </div>

      {showSchedule && (
        <div className="mt-3">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 focus:border-indigo-500/30 focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
