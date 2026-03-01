import { Plus, Loader2, Trash2, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { OpenCodeSession } from '@/types/opencode'
import { DASHBOARD_SESSION_PREFIX } from '@/services/opencode'

function displayTitle(session: OpenCodeSession): string {
  const title = session.title || `Session ${session.id.slice(0, 6)}`
  return title.startsWith(DASHBOARD_SESSION_PREFIX)
    ? title.slice(DASHBOARD_SESSION_PREFIX.length)
    : title
}

interface SessionSidebarProps {
  sessions: OpenCodeSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
  isCreating: boolean
  open: boolean
  onClose: () => void
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isCreating,
  open,
  onClose,
}: SessionSidebarProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Sessions
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
            onClick={onClose}
          >
            <X size={14} />
          </Button>
        </div>

        <div className="px-3 pb-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100"
            onClick={onCreateSession}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            New session
          </Button>
        </div>

        <Separator className="bg-white/[0.04]" />

        {/* Session list */}
        <ScrollArea className="flex-1 min-h-0">
          {sessions.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageSquare size={20} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-xs text-zinc-600">No sessions yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id)
                    onClose()
                  }}
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors',
                    session.id === activeSessionId
                      ? 'bg-white/[0.06] text-zinc-100'
                      : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {displayTitle(session)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {relativeTime(session.updatedAt)}
                    </p>
                  </div>
                  <button
                    className="shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/[0.06]"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    title="Delete session"
                  >
                    <Trash2
                      size={12}
                      className="text-zinc-600 hover:text-red-400"
                    />
                  </button>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
