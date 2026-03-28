import { Bot, Circle, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBotChannels, useBotStatus } from '@/hooks/useBot'
import { cn } from '@/lib/utils'

export function SystemSection() {
  const { data: botStatus, isSuccess: connected } = useBotStatus()
  const { data: channels } = useBotChannels()

  const onlineChannels = channels?.filter((ch) => ch.connected) ?? []

  return (
    <div className="col-span-12 lg:col-span-4 rounded-3xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Bot size={22} className="text-primary" />
          <h2 className="text-base font-display font-semibold text-foreground">Agent & System</h2>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings size={18} />
        </Link>
      </div>
      <div className="px-6 pb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Circle size={12} className={cn('fill-current', connected ? 'text-primary' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', connected ? 'text-primary' : 'text-muted-foreground')}>
              {connected ? 'Online' : 'Offline'}
            </span>
            {connected && botStatus?.modelName && (
              <span className="text-xs text-muted-foreground">{botStatus.modelName}</span>
            )}
          </div>

          {connected && botStatus && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{botStatus.memoryCount}</span> memories
              </span>
              <span>
                <span className="font-semibold text-foreground">{botStatus.toolCount}</span> tools
              </span>
              <span>
                <span className="font-semibold text-foreground">{botStatus.activeSchedules}</span> schedules
              </span>
            </div>
          )}

          {onlineChannels.length > 0 && (
            <div className="flex items-center gap-2">
              {onlineChannels.map((ch) => (
                <span
                  key={ch.channel}
                  className="rounded-xl bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize"
                >
                  {ch.channel}
                </span>
              ))}
            </div>
          )}

          {connected && (
            <div className="flex items-center gap-3">
              <Link to="/canvas" className="text-sm text-primary hover:opacity-80 transition-opacity">
                Canvas
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
