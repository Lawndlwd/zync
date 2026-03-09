import { useState, useCallback } from 'react'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  useOpenCodeSessions,
  useCreateSession,
  useDeleteSession,
} from '@/hooks/useOpenCode'
import { useOpenCodeStore } from '@/store/opencode'
import { DASHBOARD_SESSION_PREFIX } from '@/services/opencode'

export function SessionSelector() {
  const activeSessionId = useOpenCodeStore((s) => s.activeSessionId)
  const setActiveSessionId = useOpenCodeStore((s) => s.setActiveSessionId)

  // Only fetch sessions when the dropdown has been opened at least once
  const [opened, setOpened] = useState(false)
  const { data: sessions = [] } = useOpenCodeSessions(opened)
  const createSession = useCreateSession()
  const deleteSession = useDeleteSession()
  const queryClient = useQueryClient()

  const handleOpen = useCallback(() => {
    setOpened(true)
    // Always refetch when opening to get fresh list
    queryClient.invalidateQueries({ queryKey: ['opencode', 'sessions'] })
  }, [queryClient])

  const sessionOptions = sessions.map((s) => ({
    value: s.id,
    label: s.title.replace(DASHBOARD_SESSION_PREFIX, '') || `Session ${s.id.slice(0, 6)}`,
  }))

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Combobox
        value={activeSessionId ?? ''}
        onChange={(v) => setActiveSessionId(v || null)}
        onOpen={handleOpen}
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
  )
}
