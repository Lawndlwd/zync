import { cn } from '@/lib/utils'

export type SocialTab = 'feed' | 'instagram' | 'x' | 'youtube' | 'telegram' | 'comments' | 'ideas' | 'rules'

const tabs: { id: SocialTab; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'comments', label: 'Comments' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'rules', label: 'Rules' },
]

interface SocialPlatformTabsProps {
  active: SocialTab
  onChange: (tab: SocialTab) => void
  commentCount?: number
}

export function SocialPlatformTabs({ active, onChange, commentCount }: SocialPlatformTabsProps) {
  return (
    <div className="flex gap-1 border-b border-white/[0.06] pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
            active === tab.id
              ? 'bg-white/[0.08] text-zinc-100'
              : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
          )}
        >
          {tab.label}
          {tab.id === 'comments' && commentCount != null && commentCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/20 px-1.5 text-xs text-rose-400">
              {commentCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
