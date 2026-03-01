import { useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentModelConfig } from '@/types/settings'
import {
  checkConnection,
  fetchProviders,
  fetchSessions,
  fetchMessages,
  createSession,
  deleteSession,
  abortSession,
  sendPrompt,
  DASHBOARD_SESSION_PREFIX,
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

export function useSendPrompt() {
  const queryClient = useQueryClient()
  const { data: agentModels } = useAgentModels()

  return useMutation({
    mutationFn: ({ sessionId, text }: { sessionId: string; text: string }) => {
      let model: { providerID: string; modelID: string } | undefined
      if (agentModels?.opencode?.model) {
        const [providerID, ...rest] = agentModels.opencode.model.split('/')
        model = { providerID, modelID: rest.join('/') }
      }
      return sendPrompt(sessionId, text, model)
    },
    onSuccess: (_, { sessionId }) => {
      // Single invalidation after sending — SSE will handle subsequent updates
      queryClient.invalidateQueries({ queryKey: ['opencode', 'messages', sessionId] })
    },
  })
}

export function useSessionTokens(sessionId: string | null) {
  const { data: messages } = useOpenCodeMessages(sessionId)

  return useMemo(() => {
    if (!messages) return null
    let input = 0, output = 0, reasoning = 0, cacheRead = 0, cacheWrite = 0, cost = 0
    const models = new Set<string>()

    for (const msg of messages) {
      if (msg.tokens) {
        input += msg.tokens.input
        output += msg.tokens.output
        reasoning += msg.tokens.reasoning
        cacheRead += msg.tokens.cache.read
        cacheWrite += msg.tokens.cache.write
      }
      if (msg.cost) cost += msg.cost
      if (msg.modelId) models.add(msg.modelId)
    }

    return {
      input, output, reasoning, cacheRead, cacheWrite, cost,
      total: input + output + reasoning,
      models: Array.from(models),
    }
  }, [messages])
}

export type SessionSource = 'all' | 'dashboard' | 'external'

export function useAllSessionsTokens(days?: number, source: SessionSource = 'all') {
  const { data: allSessions = [] } = useOpenCodeSessions()

  const sessions = useMemo(() => {
    let filtered = allSessions
    if (days) {
      const cutoff = Date.now() - days * 86_400_000
      filtered = filtered.filter((s) => new Date(s.createdAt).getTime() >= cutoff)
    }
    if (source === 'dashboard') {
      filtered = filtered.filter((s) => s.title.startsWith(DASHBOARD_SESSION_PREFIX))
    } else if (source === 'external') {
      filtered = filtered.filter((s) => !s.title.startsWith(DASHBOARD_SESSION_PREFIX))
    }
    return filtered
  }, [allSessions, days, source])

  const messageQueries = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ['opencode', 'messages', session.id],
      queryFn: () => fetchMessages(session.id),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  })

  return useMemo(() => {
    let input = 0, output = 0, reasoning = 0, cacheRead = 0, cacheWrite = 0, cost = 0
    const models = new Set<string>()
    const perSession: Array<{
      id: string; title: string; input: number; output: number
      reasoning: number; cost: number; models: string[]; updatedAt: string
    }> = []

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      const messages = messageQueries[i]?.data
      if (!messages) continue

      let sInput = 0, sOutput = 0, sReasoning = 0, sCost = 0
      const sModels = new Set<string>()
      for (const msg of messages) {
        if (msg.tokens) {
          sInput += msg.tokens.input
          sOutput += msg.tokens.output
          sReasoning += msg.tokens.reasoning
          cacheRead += msg.tokens.cache.read
          cacheWrite += msg.tokens.cache.write
        }
        if (msg.cost) sCost += msg.cost
        if (msg.modelId) { sModels.add(msg.modelId); models.add(msg.modelId) }
      }
      input += sInput; output += sOutput; reasoning += sReasoning; cost += sCost
      perSession.push({
        id: session.id, title: session.title || `Session ${session.id.slice(0, 6)}`,
        input: sInput, output: sOutput, reasoning: sReasoning, cost: sCost,
        models: Array.from(sModels), updatedAt: session.updatedAt,
      })
    }

    return {
      input, output, reasoning, cacheRead, cacheWrite, cost,
      total: input + output + reasoning,
      models: Array.from(models),
      sessionCount: sessions.length,
      perSession,
    }
  }, [sessions, messageQueries])
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
