import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentModelConfig } from '@zync/shared/types'
import {
  checkConnection,
  fetchProviders,
  fetchSessions,
  fetchMessages,
  createSession,
  deleteSession,
  abortSession,
} from '@/services/opencode'
import { useOpenCodeStore } from '@/store/opencode'

export function useOpenCodeStatus() {
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)
  const setConnectionStatus = useOpenCodeStore((s) => s.setConnectionStatus)
  const connected = useOpenCodeStore((s) => s.connectionStatus.connected)

  return useQuery({
    queryKey: ['opencode', 'status', serverUrl],
    queryFn: async () => {
      const status = await checkConnection(serverUrl)
      setConnectionStatus(status)
      return status
    },
    // Poll only when disconnected (to detect reconnection), otherwise rely on SSE
    refetchInterval: connected ? false : 10_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30_000,
  })
}

export function useOpenCodeProviders() {
  const serverUrl = useOpenCodeStore((s) => s.serverUrl)
  const { data: status } = useOpenCodeStatus()

  return useQuery({
    queryKey: ['opencode', 'providers', serverUrl],
    queryFn: () => fetchProviders(serverUrl),
    enabled: status?.connected === true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useOpenCodeSessions() {
  return useQuery({
    queryKey: ['opencode', 'sessions'],
    queryFn: fetchSessions,
    // No polling — SSE handles real-time updates
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // keep previous data during refetch to prevent flicker
  })
}

export function useOpenCodeMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['opencode', 'messages', sessionId],
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
    // No polling — SSE handles real-time updates
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // keep previous data during refetch to prevent flicker
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  const setActiveSessionId = useOpenCodeStore((s) => s.setActiveSessionId)

  return useMutation({
    mutationFn: (title?: string) => createSession(title),
    onSuccess: (session) => {
      setActiveSessionId(session.id)
      queryClient.invalidateQueries({ queryKey: ['opencode', 'sessions'] })
    },
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  const activeSessionId = useOpenCodeStore((s) => s.activeSessionId)
  const setActiveSessionId = useOpenCodeStore((s) => s.setActiveSessionId)

  return useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: (_, sessionId) => {
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
      queryClient.invalidateQueries({ queryKey: ['opencode', 'sessions'] })
    },
  })
}

export function useAbortSession() {
  return useMutation({
    mutationFn: (sessionId: string) => abortSession(sessionId),
  })
}

export function useSessionTokens(sessionId: string | null) {
  const { data: messages } = useOpenCodeMessages(sessionId)

  return useMemo(() => {
    if (!messages) return null
    let outputTotal = 0, reasoningTotal = 0, cacheRead = 0, cacheWrite = 0, cost = 0
    let contextInput = 0
    const models = new Set<string>()

    for (const msg of messages) {
      if (msg.tokens) {
        // Use the latest message's input as "context size" (like OpenCode does)
        // since each turn re-sends the full context
        if (msg.tokens.input > 0) contextInput = msg.tokens.input
        outputTotal += msg.tokens.output
        reasoningTotal += msg.tokens.reasoning
        cacheRead += msg.tokens.cache.read
        cacheWrite += msg.tokens.cache.write
      }
      if (msg.cost) cost += msg.cost
      if (msg.modelId) models.add(msg.modelId)
    }

    return {
      input: contextInput, output: outputTotal, reasoning: reasoningTotal,
      cacheRead, cacheWrite, cost,
      total: contextInput + outputTotal + reasoningTotal,
      models: Array.from(models),
    }
  }, [messages])
}

export type SessionSource = 'all' | 'dashboard' | 'external'

const EMPTY_TOKEN_STATS = {
  input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0,
  cost: 0, total: 0, models: [] as string[], sessionCount: 0,
}

export function useAllSessionsTokens(days?: number, _source: SessionSource = 'all') {
  const params = days ? `?days=${days}` : ''
  const { data } = useQuery({
    queryKey: ['opencode', 'token-stats', days],
    queryFn: async () => {
      const res = await fetch(`/api/opencode/token-stats${params}`)
      if (!res.ok) throw new Error('Failed to fetch token stats')
      return res.json()
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  return data ?? EMPTY_TOKEN_STATS
}

export function useAgentModels() {
  return useQuery<AgentModelConfig>({
    queryKey: ['settings', 'agent-models'],
    queryFn: async () => {
      const res = await fetch('/api/settings/agent-models')
      if (!res.ok) throw new Error('Failed to load agent models')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useSaveAgentModels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: AgentModelConfig) => {
      const res = await fetch('/api/settings/agent-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Failed to save agent models')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'agent-models'] })
    },
  })
}
