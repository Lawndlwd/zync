import { useEffect, useCallback } from 'react'
import { usePRAgentStore } from '@/store/pr-agent'

export type { DebugInfo, ChatMessage } from '@/store/pr-agent'

type PRAgentTool = 'review' | 'describe' | 'improve' | 'ask'

interface RunOptions {
  question?: string
  extraInstructions?: string
}

export function usePRAgent(projectId: number, mrIid: number, mrWebUrl: string, headSha?: string) {
  const key = `${projectId}:${mrIid}`
  const store = usePRAgentStore()
  const activeRun = store.getActiveRun(key)
  const messages = store.getMessages(key)
  const loaded = store.isLoaded(key)

  // Load history from DB on mount
  useEffect(() => {
    if (!loaded) {
      store.loadHistory(key, projectId, mrIid)
    }
  }, [key, projectId, mrIid, loaded])

  const run = useCallback((tool: PRAgentTool, options?: RunOptions) => {
    store.run(key, tool, { mrWebUrl, projectId, mrIid, headSha }, options)
  }, [key, mrWebUrl, projectId, mrIid, headSha])

  return {
    isRunning: activeRun?.isRunning ?? false,
    runningTool: activeRun?.tool ?? null,
    status: activeRun?.status ?? '',
    streamContent: activeRun?.streamContent ?? '',
    messages,
    headSha,
    error: activeRun?.error ?? null,
    debugInfo: activeRun?.debugInfo ?? null,
    run,
  }
}
