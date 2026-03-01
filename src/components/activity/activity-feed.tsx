import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from '@/services/activity'
import { Badge } from '@/components/ui/badge'
import { Clock, Wrench } from 'lucide-react'

const SOURCE_BADGE: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'default' }> = {
  chat: { label: 'Chat', variant: 'primary' },
  bot: { label: 'Bot', variant: 'success' },
  schedule: { label: 'Schedule', variant: 'warning' },
  'pr-agent': { label: 'PR-Agent', variant: 'info' },
}

export function ActivityFeed() {
  const { data: calls } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => fetchActivity(100),
    staleTime: 30_000,
  })

  if (!calls || calls.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-zinc-500">No AI calls recorded yet. Send a chat message to get started.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03]">
      <p className="text-sm font-medium text-zinc-300 p-4 border-b border-white/[0.08]">Recent Activity</p>
      <div className="divide-y divide-white/[0.08] max-h-[480px] overflow-y-auto">
        {calls.map((call) => {
          const badge = SOURCE_BADGE[call.source] ?? SOURCE_BADGE.chat
          const time = new Date(call.created_at + 'Z')
          return (
            <div key={call.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs text-zinc-600 w-16 shrink-0">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge variant={badge.variant} className="w-16 justify-center shrink-0">
                {badge.label}
              </Badge>
              <span className="text-sm text-zinc-400 truncate min-w-0 flex-1">
                {call.tool_names.length > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Wrench size={12} className="text-zinc-500 shrink-0" />
                    {call.tool_names.join(', ')}
                  </span>
                ) : (
                  'Chat response'
                )}
              </span>
              <span className="text-xs text-zinc-500 shrink-0">{call.model}</span>
              <span className="text-xs text-zinc-500 shrink-0 w-16 text-right">
                {formatTokens(call.total_tokens)} tok
              </span>
              <span className="text-xs text-zinc-600 shrink-0 w-12 text-right inline-flex items-center justify-end gap-1">
                <Clock size={10} />
                {call.duration_ms < 1000
                  ? `${call.duration_ms}ms`
                  : `${(call.duration_ms / 1000).toFixed(1)}s`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
