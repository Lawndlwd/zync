import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle2, Circle, Clock, DollarSign, Zap } from 'lucide-react'
import { useBotChannels, useBotStatus, useBriefingConfig } from '@/hooks/useBot'
import { cn } from '@/lib/utils'
import { fetchActivityStats } from '@/services/activity'
import { useJournalStore } from '@/store/journal'

function cronToTime(cron: string): string | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return null
  const minute = parseInt(parts[0], 10)
  const hour = parseInt(parts[1], 10)
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

export function TodayStrip() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const journalEntry = useJournalStore((s) => s.getEntry(today))
  const { data: briefingConfig } = useBriefingConfig()
  const { isSuccess: connected } = useBotStatus()
  const { data: channels } = useBotChannels()
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', 1],
    queryFn: () => fetchActivityStats(1),
    staleTime: 60_000,
    retry: 1,
  })

  const onlineChannels = channels?.filter((ch) => ch.connected) ?? []

  const nextBriefing = briefingConfig?.enabled
    ? (cronToTime(briefingConfig.morningCron) ?? cronToTime(briefingConfig.eveningCron))
    : null

  return (
    <div className="col-span-12 rounded-3xl bg-card border border-border py-4 px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-sm">
          {journalEntry ? (
            <>
              <CheckCircle2 size={16} className="text-primary" />
              <span className="text-foreground">Entry written</span>
            </>
          ) : (
            <>
              <Circle size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">No entry yet</span>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-border hidden sm:block" />

        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">
            {nextBriefing ? `Next briefing ${nextBriefing}` : 'Briefings off'}
          </span>
        </div>

        <div className="w-px h-4 bg-border hidden sm:block" />

        <div className="flex items-center gap-2 text-sm">
          <DollarSign size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">${stats?.totals.total_cost?.toFixed(2) ?? '0.00'} today</span>
        </div>

        <div className="w-px h-4 bg-border hidden sm:block" />

        <div className="flex items-center gap-2 text-sm">
          <Zap size={16} className="text-primary" />
          <span className="text-muted-foreground">{stats?.callsToday ?? 0} calls</span>
        </div>

        <div className="w-px h-4 bg-border hidden sm:block" />

        <div className="flex items-center gap-2 text-sm">
          <Circle size={10} className={cn('fill-current', connected ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn(connected ? 'text-primary' : 'text-muted-foreground')}>
            {connected ? 'Online' : 'Offline'}
          </span>
          {onlineChannels.map((ch) => (
            <span
              key={ch.channel}
              className="rounded-xl bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize"
            >
              {ch.channel}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
