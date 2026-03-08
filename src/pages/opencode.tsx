import { useEffect, useMemo } from 'react'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { OpenCodeChat } from '@/components/opencode/OpenCodeChat'
import { SessionInfo } from '@/components/opencode/SessionInfo'
import {
  useOpenCodeSessions,
  useCreateSession,
  useDeleteSession,
} from '@/hooks/useOpenCode'
import { useOpenCodeStore } from '@/store/opencode'
import { DASHBOARD_SESSION_PREFIX } from '@/services/opencode'

export function OpenCodePage() {
  const activeSessionId = useOpenCodeStore((s) => s.activeSessionId)
  const setActiveSessionId = useOpenCodeStore((s) => s.setActiveSessionId)

  const { data: allSessions = [] } = useOpenCodeSessions()
  const createSession = useCreateSession()
  const deleteSession = useDeleteSession()

  const sessions = useMemo(
    () => allSessions.filter((s) => s.title.startsWith(DASHBOARD_SESSION_PREFIX)),
    [allSessions]
  )

  // Sync persisted active session to backend on mount
  useEffect(() => {
    if (activeSessionId) {
      fetch('/api/opencode/active-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId }),
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select: if no active session or the persisted one no longer exists, pick the most recent
  useEffect(() => {
    if (sessions.length === 0) {
      // No dashboard sessions yet — sync with backend's chat session
      if (!activeSessionId) {
        fetch('/api/opencode/chat-session')
          .then((r) => r.json())
          .then((data) => {
            if (data.sessionId) setActiveSessionId(data.sessionId)
          })
          .catch(() => {})
      }
      return
    }
    if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) return
    // Pick the most recent dashboard session (sorted by updatedAt desc)
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    setActiveSessionId(sorted[0].id)
  }, [sessions, activeSessionId, setActiveSessionId])

  const sessionOptions = sessions.map((s) => ({
    value: s.id,
    label: s.title.slice(DASHBOARD_SESSION_PREFIX.length) || `Session ${s.id.slice(0, 6)}`,
  }))

  return (
    <div className="-mx-8 -mt-8 lg:-mx-10 flex flex-col overflow-hidden h-[100vh]">
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between shrink-0 border-b border-white/[0.06] px-4 py-2 gap-3">
            <span className="text-sm font-medium text-zinc-400 shrink-0">Chat</span>
            <div className="flex items-center gap-2 min-w-0">
              <Combobox
                value={activeSessionId ?? ''}
                onChange={(v) => setActiveSessionId(v || null)}
                options={sessionOptions}
                placeholder="Select session..."
                searchPlaceholder="Search sessions..."
                className="w-64"
              />
              {activeSessionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => deleteSession.mutate(activeSessionId)}
                  title="Delete session"
                >
                  <Trash2 size={14} />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                onClick={() => createSession.mutate(undefined)}
                disabled={createSession.isPending}
              >
                {createSession.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                New
              </Button>
            </div>
          </div>
          <div className="flex flex-1 min-h-0 flex-col relative">
            <OpenCodeChat />
          </div>
        </div>
        <SessionInfo sessionId={activeSessionId} />
      </div>
    </div>
  )
}
