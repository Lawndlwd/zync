import { useEffect } from 'react'
import { OpenCodeChat } from '@/components/opencode/OpenCodeChat'
import { SessionInfo } from '@/components/opencode/SessionInfo'
import { SessionSelector } from '@/components/opencode/SessionSelector'
import { useOpenCodeStore } from '@/store/opencode'

export function OpenCodePage() {
  const activeSessionId = useOpenCodeStore((s) => s.activeSessionId)
  const setActiveSessionId = useOpenCodeStore((s) => s.setActiveSessionId)

  // Sync persisted active session to backend on mount
  useEffect(() => {
    if (activeSessionId) {
      fetch('/api/opencode/active-session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId }),
      }).catch(() => {})
    } else {
      // No active session — sync with backend's chat session
      fetch('/api/opencode/chat-session')
        .then((r) => r.json())
        .then((data) => {
          if (data.sessionId) setActiveSessionId(data.sessionId)
        })
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-mx-8 -mt-8 lg:-mx-10 flex flex-col overflow-hidden h-[100vh]">
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between shrink-0 border-b border-white/[0.06] px-4 py-2 gap-3">
            <span className="text-sm font-medium text-zinc-400 shrink-0">Chat</span>
            <SessionSelector />
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
